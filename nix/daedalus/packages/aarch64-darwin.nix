{ inputs, cell }:

let common = import ./common.nix { inherit inputs cell; }; in

{
  mkInternal = cluster: import ./old-code/old-default.nix {
    inherit inputs;
    cluster = cluster;
    buildNum = toString common.buildNumber;
    target = "aarch64-darwin";
    buildSystem = inputs.nixpkgs.system;
  };
}
