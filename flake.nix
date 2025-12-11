{
  description = "opencode-beads development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    beads.url = "github:steveyegge/beads";
  };

  outputs = { self, nixpkgs, flake-utils, beads }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        bd = beads.packages.${system}.default;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Development
            bun
            nodejs_22
            typescript

            # Demo recording
            vhs
            ffmpeg

            # Beads CLI
            bd
          ];

          shellHook = ''
            echo "opencode-beads dev shell"
            echo "bd version: $(bd --version 2>/dev/null || echo 'available')"
          '';
        };

        # Demo shell with isolated beads environment
        devShells.demo = pkgs.mkShell {
          buildInputs = with pkgs; [
            vhs
            ffmpeg
            bd
          ];

          shellHook = ''
            # Create temp demo directory
            export DEMO_DIR=$(mktemp -d)
            cd "$DEMO_DIR"
            
            # Initialize beads with JSONL backend
            bd init --backend jsonl
            
            echo "Demo environment ready at $DEMO_DIR"
            echo "Run: vhs demo.tape"
          '';
        };
      }
    );
}
