{ inputs, cell }:

let

  common = import ./packages/common.nix { inherit inputs cell; };

  # Infinite recursion in evaluation of `devShells.default`, if we use `common.forEachCluster`.
  # TODO: submit issue to `divnix/std`
  inherit (import (inputs.self + "/nix/daedalus/packages/clusters.nix")) forEachCluster;
  #inherit (common) forEachCluster;

  system = inputs.nixpkgs.system;

in

if system == "x86_64-linux" || system == "x86_64-darwin" || system == "aarch64-darwin" then

  # E.g. `nix develop .#testnet`:
  (forEachCluster (cluster:
    import ./packages/old-code/old-shell.nix {
      inherit inputs system cluster;
      pkgs = import inputs.nixpkgs-ancient { inherit system; config = {}; };
      daedalusPkgs = common.${system}.mkInternal cluster;
    }
  ))

  // rec {

    # Plain `nix develop`:
    default = cell.devshells.mainnet;

    # E.g. `nix develop .#fixYarnLock` – TODO: shouldn’t it be a `nix run` script instead?
    inherit (default) fixYarnLock buildShell devops;

  }

else abort "unsupported system: ${inputs.nixpkgs.system}"
