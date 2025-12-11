# VHS Demo for opencode-beads
# 
# Setup:
#   1. nix develop
#   2. Create temp dir and init beads: mkdir /tmp/demo && cd /tmp/demo && bd init --backend jsonl
#   3. Run: vhs demo.tape
#
# Or use the demo shell:
#   nix develop .#demo
#   vhs /path/to/demo.tape

Output demo.gif

Set Shell "bash"
Set FontSize 16
Set Width 1024
Set Height 768
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 50ms

# Show we're in a beads-enabled project
Type "bd status"
Enter
Sleep 2s

# Start opencode
Type "opencode"
Enter
Sleep 3s

# Create an issue (shows toast: "Issue created: {id}")
Type "Create a new beads issue titled 'Add dark mode support'"
Enter
Sleep 6s

# List issues to verify
Type "List all open issues"
Enter
Sleep 5s

# Add a label (shows toast: "Label added")
Type "Add the label 'enhancement' to the issue we just created"
Enter
Sleep 5s

# Add a dependency - create second issue first
Type "Create another issue titled 'Design color palette'"
Enter
Sleep 6s

# Add dependency (shows toast: "Dependency added")
Type "Make the dark mode issue depend on the color palette issue"
Enter
Sleep 5s

# Show blocked issues
Type "Show me blocked issues"
Enter
Sleep 5s

# Close the dependency (shows toast: "Issue closed")
Type "Close the color palette issue"
Enter
Sleep 5s

# Show ready issues (dark mode should now be ready)
Type "Show me issues that are ready to work on"
Enter
Sleep 5s

# Exit
Type "exit"
Enter
Sleep 1s
