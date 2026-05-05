mod support;

use support::{temp_db_path, test_repository};
use workflow_automation_manager_lib::{
    db::{create_sqlite_pool, run_migrations},
    domain::{
        ActionConfig, GraphEdge, GraphNode, GraphNodeType, GraphPort, GraphPortDirection,
        GraphPosition, GraphViewport, InputTypingMode, ScrollDirection, WaitCondition,
        WorkflowBrowserChallengePolicy, WorkflowBrowserConfig, WorkflowGraph,
    },
    repositories::WorkflowRepository,
};

#[tokio::test]
async fn workflow_crud_and_step_count_work() {
    let (repo, _db_path) = test_repository().await;

    let workflow = repo.create_workflow("Login flow").await.expect("create");

    repo.add_step(
        &workflow.id,
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
    )
    .await
    .expect("add step");

    let summaries = repo.list_workflows().await.expect("list");
    assert_eq!(summaries.len(), 1);
    assert_eq!(summaries[0].name, "Login flow");
    assert_eq!(summaries[0].step_count, 1);

    repo.rename_workflow(&workflow.id, "Renamed flow")
        .await
        .expect("rename");

    let detail = repo
        .get_workflow(&workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");
    assert_eq!(detail.workflow.name, "Renamed flow");
    assert_eq!(detail.steps.len(), 1);
}

#[tokio::test]
async fn step_config_round_trips_through_json() {
    let (repo, _db_path) = test_repository().await;
    let workflow = repo.create_workflow("Typing").await.expect("create");

    let step = repo
        .add_step(
            &workflow.id,
            ActionConfig::InputText {
                xpath: "//*[@name=\"email\"]".to_string(),
                iframe_xpath: None,
                text: "user@example.com".to_string(),
                clear_before_input: true,
                typing_mode: Some(InputTypingMode::SetValue),
                delay_ms: None,
                wait_until: None,
                timeout_ms: None,
            },
        )
        .await
        .expect("add step");

    repo.update_step(
        &step.id,
        "Scroll page",
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 500,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        },
    )
    .await
    .expect("update step");

    let detail = repo
        .get_workflow(&workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");

    assert_eq!(
        detail.steps[0].config,
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 500,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        }
    );
}

#[tokio::test]
async fn repository_normalizes_legacy_step_configs_when_reading_old_databases() {
    let db_path = temp_db_path("wam-legacy-normalize-test");
    let pool = create_sqlite_pool(&db_path)
        .await
        .expect("create sqlite pool");
    run_migrations(&pool).await.expect("run migrations");
    let repo = WorkflowRepository::new(pool.clone());
    let workflow = repo.create_workflow("Old flow").await.expect("create");

    sqlx::query(
        r#"
        INSERT INTO workflow_steps
          (id, workflow_id, order_index, type, name, config_json, created_at, updated_at)
        VALUES
          ('old-open', ?1, 0, 'open_url', 'Open URL', '{"type":"open_url","config":{"url":"https://example.com"}}', '2026-04-30T00:00:00Z', '2026-04-30T00:00:00Z'),
          ('old-sleep', ?1, 1, 'sleep', 'Sleep', '{"type":"sleep","config":{"seconds":1.5}}', '2026-04-30T00:00:00Z', '2026-04-30T00:00:00Z'),
          ('old-type', ?1, 2, 'type_text', 'Type Text', '{"type":"type_text","config":{"xpath":"//*[@name=\"email\"]","text":"user@example.com"}}', '2026-04-30T00:00:00Z', '2026-04-30T00:00:00Z')
        "#,
    )
    .bind(&workflow.id)
    .execute(&pool)
    .await
    .expect("insert legacy steps");

    let detail = repo
        .get_workflow(&workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");

    assert_eq!(detail.steps[0].action_type.as_str(), "navigate");
    assert_eq!(
        detail.steps[0].config,
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: None,
        }
    );
    assert_eq!(
        detail.steps[1].config,
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(1500),
            timeout_ms: None,
        }
    );
    assert_eq!(
        detail.steps[2].config,
        ActionConfig::InputText {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            text: "user@example.com".to_string(),
            clear_before_input: true,
            typing_mode: Some(InputTypingMode::SetValue),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        }
    );
}

#[tokio::test]
async fn reorder_persists_and_delete_compacts_order_indexes() {
    let (repo, _db_path) = test_repository().await;
    let workflow = repo.create_workflow("Ordering").await.expect("create");

    let first = repo
        .add_step(&workflow.id, wait_duration(1000))
        .await
        .expect("first");
    let second = repo
        .add_step(
            &workflow.id,
            ActionConfig::Click {
                xpath: "//*[@id=\"submit\"]".to_string(),
                iframe_xpath: None,
                mode: None,
                button: None,
                click_count: None,
                scroll_into_view: None,
                block: None,
                inline: None,
                position: None,
                offset_x: None,
                offset_y: None,
                wait_until: None,
                timeout_ms: None,
                retry_interval_ms: None,
                post_click_wait_ms: None,
            },
        )
        .await
        .expect("second");
    let third = repo
        .add_step(
            &workflow.id,
            ActionConfig::Navigate {
                url: "https://example.com".to_string(),
                wait_until: None,
                timeout_ms: None,
            },
        )
        .await
        .expect("third");

    repo.reorder_steps(
        &workflow.id,
        &[third.id.clone(), first.id.clone(), second.id.clone()],
    )
    .await
    .expect("reorder");

    let detail = repo
        .get_workflow(&workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");
    assert_eq!(detail.steps[0].id, third.id);
    assert_eq!(detail.steps[0].order_index, 0);
    assert_eq!(detail.steps[1].id, first.id);
    assert_eq!(detail.steps[1].order_index, 1);
    assert_eq!(detail.steps[2].id, second.id);
    assert_eq!(detail.steps[2].order_index, 2);

    repo.delete_step(&first.id).await.expect("delete step");

    let detail = repo
        .get_workflow(&workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");
    assert_eq!(detail.steps.len(), 2);
    assert_eq!(detail.steps[0].order_index, 0);
    assert_eq!(detail.steps[1].order_index, 1);
}

#[tokio::test]
async fn deleting_workflow_cascades_steps() {
    let (repo, _db_path) = test_repository().await;
    let workflow = repo.create_workflow("Cascade").await.expect("create");
    repo.add_step(&workflow.id, wait_duration(1000))
        .await
        .expect("add step");

    repo.delete_workflow(&workflow.id)
        .await
        .expect("delete workflow");

    let summaries = repo.list_workflows().await.expect("list");
    assert!(summaries.is_empty());

    let detail = repo.get_workflow(&workflow.id).await.expect("missing");
    assert!(detail.is_none());
}

#[tokio::test]
async fn workflow_graph_persists_and_round_trips() {
    let (repo, _db_path) = test_repository().await;
    let workflow = repo.create_workflow("Visual graph").await.expect("create");
    let graph = sample_graph();

    repo.save_workflow_graph(&workflow.id, graph.clone())
        .await
        .expect("save graph");

    let loaded = repo
        .get_workflow_graph(&workflow.id)
        .await
        .expect("get graph")
        .expect("graph exists");

    assert_eq!(loaded, graph);
}

#[tokio::test]
async fn workflow_graph_is_created_by_default_and_cascades() {
    let (repo, _db_path) = test_repository().await;
    let workflow = repo
        .create_workflow("Graph workflow")
        .await
        .expect("create");

    let default_graph = repo
        .get_workflow_graph(&workflow.id)
        .await
        .expect("get graph")
        .expect("default graph exists");
    assert_eq!(default_graph.nodes.len(), 2);
    assert_eq!(default_graph.nodes[0].node_type, GraphNodeType::Start);
    assert_eq!(default_graph.nodes[1].node_type, GraphNodeType::Action);
    assert_eq!(default_graph.nodes[1].label, "New node");
    assert!(default_graph.nodes[1].config.is_null());
    assert_eq!(default_graph.edges.len(), 1);
    assert_eq!(default_graph.edges[0].source_node_id, "start");
    assert_eq!(default_graph.edges[0].target_node_id, "new-node");

    repo.save_workflow_graph(&workflow.id, sample_graph())
        .await
        .expect("save graph");
    repo.delete_workflow(&workflow.id)
        .await
        .expect("delete workflow");

    let deleted = repo
        .get_workflow_graph(&workflow.id)
        .await
        .expect("get graph");
    assert!(deleted.is_none());
}

#[tokio::test]
async fn workflow_browser_config_persists_round_trips_and_cascades() {
    let (repo, _db_path) = test_repository().await;
    let workflow = repo
        .create_workflow("Runtime config")
        .await
        .expect("create");

    assert!(repo
        .get_workflow_browser_config(&workflow.id)
        .await
        .expect("get missing browser config")
        .is_none());

    let config = WorkflowBrowserConfig {
        workflow_id: workflow.id.clone(),
        profile_name: Some(" qa-profile ".to_string()),
        proxy_enabled: true,
        proxy_server: Some("http://proxy.local:8080".to_string()),
        proxy_username: Some(" agent ".to_string()),
        proxy_password: Some("secret".to_string()),
        user_agent: Some("WorkflowBot/1.0".to_string()),
        viewport_width: Some(1280),
        viewport_height: Some(720),
        mobile: false,
        touch: true,
        challenge_policy: WorkflowBrowserChallengePolicy::DetectOnly,
    };

    repo.save_workflow_browser_config(config.clone())
        .await
        .expect("save browser config");

    let loaded = repo
        .get_workflow_browser_config(&workflow.id)
        .await
        .expect("get browser config")
        .expect("browser config exists");
    assert_eq!(loaded, config.normalized());

    repo.delete_workflow(&workflow.id)
        .await
        .expect("delete workflow");
    assert!(repo
        .get_workflow_browser_config(&workflow.id)
        .await
        .expect("get deleted browser config")
        .is_none());
}

fn wait_duration(duration_ms: u64) -> ActionConfig {
    ActionConfig::Wait {
        condition: WaitCondition::Duration,
        xpath: None,
        text: None,
        url: None,
        duration_ms: Some(duration_ms),
        timeout_ms: None,
    }
}

fn sample_graph() -> WorkflowGraph {
    WorkflowGraph {
        version: 1,
        nodes: vec![
            GraphNode {
                id: "start".to_string(),
                node_type: GraphNodeType::Start,
                label: "Start".to_string(),
                position: GraphPosition { x: 0.0, y: 0.0 },
                config: serde_json::json!({}),
                ports: vec![GraphPort {
                    id: "out".to_string(),
                    label: "Out".to_string(),
                    direction: GraphPortDirection::Output,
                }],
                group_id: None,
            },
            GraphNode {
                id: "wait".to_string(),
                node_type: GraphNodeType::Action,
                label: "Wait".to_string(),
                position: GraphPosition { x: 220.0, y: 0.0 },
                config: serde_json::json!({
                    "type": "wait",
                    "config": {
                        "condition": "duration",
                        "duration_ms": 100
                    }
                }),
                ports: vec![
                    GraphPort {
                        id: "in".to_string(),
                        label: "In".to_string(),
                        direction: GraphPortDirection::Input,
                    },
                    GraphPort {
                        id: "out".to_string(),
                        label: "Out".to_string(),
                        direction: GraphPortDirection::Output,
                    },
                ],
                group_id: None,
            },
        ],
        edges: vec![GraphEdge {
            id: "edge-start-wait".to_string(),
            source_node_id: "start".to_string(),
            source_port: "out".to_string(),
            target_node_id: "wait".to_string(),
            target_port: "in".to_string(),
            label: Some("next".to_string()),
            condition: None,
        }],
        viewport: GraphViewport {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        },
    }
}
