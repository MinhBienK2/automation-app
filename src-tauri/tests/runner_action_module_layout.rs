use std::fs;

#[test]
fn runner_actions_are_grouped_by_user_behavior() {
    let actions_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("runner")
        .join("actions");

    for module in [
        "pointer.rs",
        "scroll.rs",
        "wait.rs",
        "input.rs",
        "form.rs",
        "keyboard.rs",
        "clipboard.rs",
        "element.rs",
    ] {
        assert!(
            actions_dir.join(module).is_file(),
            "missing runner action module {module}"
        );
    }

    assert!(
        !actions_dir.join("user_interaction.rs").exists(),
        "user_interaction.rs should be split into focused action modules"
    );

    let mod_rs = fs::read_to_string(actions_dir.join("mod.rs")).expect("read actions/mod.rs");
    assert!(mod_rs.contains("mod pointer;"));
    assert!(!mod_rs.contains("mod click;"));
    assert!(!mod_rs.contains("mod user_interaction;"));
}
