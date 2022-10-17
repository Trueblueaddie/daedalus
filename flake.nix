{
  inputs.std.url = "github:divnix/std";
  inputs.std.inputs.nixpkgs.follows = "nixpkgs";
  inputs.nixpkgs.follows = "cardano-wallet-unpatched/nixpkgs";

  # FIXME: add patches here after <https://github.com/NixOS/nix/issues/3920>
  inputs.cardano-wallet-unpatched.url = "github:input-output-hk/cardano-wallet/v2022-10-06";

  # TODO: use `inputs.nixpkgs` – leaving at the previous one, since it rebuilds the world, since we patch systemd
  inputs.nixpkgs-ancient.url = "github:NixOS/nixpkgs/b67e752c29f18a0ca5534a07661366d6a2c2e649";

  # TODO: get rid of those:
  inputs.cardano-shell = { flake = false; url = "github:input-output-hk/cardano-shell/update-haskell-nix-etc"; };
  inputs.nix-bundle = { flake = false; url = "github:input-output-hk/nix-bundle?rev=a43e9280628d6e7fcc2f89257106f5262d531bc7"; };
  inputs.nixpkgs-nsis = { flake = false; url = "github:input-output-hk/nixpkgs?rev=be445a9074f139d63e704fa82610d25456562c3d"; }; # FIXME: why not just `nixpkgs`?

  outputs = { self, std, ... } @ inputs:
    std.grow {
      inherit inputs;
      cellsFrom = ./nix;
      cellBlocks = [
        (std.installables "packages")
        (std.devshells "devshells")
      ];
      systems = ["x86_64-linux" "x86_64-darwin" "aarch64-darwin"];
    } // {
      defaultPackage = std.harvest self ["daedalus" "packages"  "default" "package" "mainnet"];
      devShell       = std.harvest self ["daedalus" "devshells" "default"];
      devShells      = std.harvest self ["daedalus" "devshells"];

      # TODO: use something like `std.harvest` as well? but how to structure cross-builds with `std`?
      packages.x86_64-linux.daedalus                  = self.outputs.x86_64-linux.daedalus.packages.default;
      packages.x86_64-linux.daedalus-x86_64-linux     = self.outputs.x86_64-linux.daedalus.packages.x86_64-linux;
      packages.x86_64-linux.daedalus-x86_64-windows   = self.outputs.x86_64-linux.daedalus.packages.x86_64-windows;

      packages.x86_64-darwin.daedalus                 = self.outputs.x86_64-darwin.daedalus.packages.default;
      packages.x86_64-darwin.daedalus-x86_64-darwin   = self.outputs.x86_64-darwin.daedalus.packages.x86_64-darwin;

      packages.aarch64-darwin.daedalus                = self.outputs.aarch64-darwin.daedalus.packages.default;
      packages.aarch64-darwin.daedalus-aarch64-darwin = self.outputs.aarch64-darwin.daedalus.packages.aarch64-darwin;
    };
}
