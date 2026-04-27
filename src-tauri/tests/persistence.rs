use std::path::PathBuf;

use uuid::Uuid;
use workflow_automation_manager_lib::{
    db::{create_sqlite_pool, run_migrations},
    domain::{ActionConfig, ScrollDirection},
    repositories::WorkflowRepository,
};

async fn test_repository() -> (WorkflowRepository, PathBuf) {
    let db_path = std::env::temp_dir().join(format!("wam-test-{}.sqlite", Uuid::new_v4()));
    let pool = create_sqlite_pool(&db_path)
        .await
        .expect("create sqlite pool");
    run_migrations(&pool).await.expect("run migrations");

    (WorkflowRepository::new(pool), db_path)
}

#[tokio::test]
async fn workflow_crud_and_step_count_work() {
    let (repo, _db_path) = test_repository().await;

    let workflow = repo.create_workflow("Login flow").await.expect("create");

    repo.add_step(
        &workflow.id,
        ActionConfig::OpenUrl {
            url: "https://example.com".to_string(),
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
            ActionConfig::TypeText {
                xpath: "//*[@name=\"email\"]".to_string(),
                text: "user@example.com".to_string(),
            },
        )
        .await
        .expect("add step");

    repo.update_step(
        &step.id,
        "Scroll page",
        ActionConfig::Scroll {
            direction: ScrollDirection::Down,
            pixels: 500,
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
            direction: ScrollDirection::Down,
            pixels: 500,
        }
    );
}

#[tokio::test]
async fn reorder_persists_and_delete_compacts_order_indexes() {
    let (repo, _db_path) = test_repository().await;
    let workflow = repo.create_workflow("Ordering").await.expect("create");

    let first = repo
        .add_step(&workflow.id, ActionConfig::Sleep { seconds: 1.0 })
        .await
        .expect("first");
    let second = repo
        .add_step(
            &workflow.id,
            ActionConfig::Click {
                xpath: "//*[@id=\"submit\"]".to_string(),
            },
        )
        .await
        .expect("second");
    let third = repo
        .add_step(
            &workflow.id,
            ActionConfig::OpenUrl {
                url: "https://example.com".to_string(),
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
    repo.add_step(&workflow.id, ActionConfig::Sleep { seconds: 1.0 })
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
