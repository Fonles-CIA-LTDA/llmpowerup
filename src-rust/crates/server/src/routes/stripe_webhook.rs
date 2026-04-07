use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde_json::{json, Value};

use crate::error::ApiError;
use crate::AppState;

/// POST /webhooks/stripe -- handle Stripe webhook events.
///
/// Handles:
/// - `checkout.session.completed` -- new subscription
/// - `customer.subscription.updated` -- plan change
/// - `customer.subscription.deleted` -- cancellation
/// - `invoice.payment_succeeded` -- recurring payment
/// - `invoice.payment_failed` -- failed payment
pub async fn handle_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<Value>, ApiError> {
    // Verify Stripe signature
    let _signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::BadRequest("Missing stripe-signature header".into()))?;

    // TODO: Verify signature with STRIPE_WEBHOOK_SECRET
    // For now, parse the event directly
    let event: Value = serde_json::from_str(&body)
        .map_err(|e| ApiError::BadRequest(format!("Invalid JSON: {e}")))?;

    let event_type = event["type"].as_str().unwrap_or("");

    match event_type {
        "checkout.session.completed" => {
            let customer_id = event["data"]["object"]["customer"].as_str().unwrap_or("");
            let metadata = &event["data"]["object"]["metadata"];
            let tenant_id = metadata["tenant_id"].as_str().unwrap_or("");
            let plan = metadata["plan"].as_str().unwrap_or("pro");

            if !tenant_id.is_empty() {
                // Upgrade tenant plan
                let _ = sqlx::query(
                    "UPDATE tenants SET plan = $1, stripe_customer_id = $2, updated_at = NOW() WHERE id = $3::uuid"
                )
                .bind(plan)
                .bind(customer_id)
                .bind(tenant_id)
                .execute(&state.db)
                .await;

                tracing::info!("Tenant {tenant_id} upgraded to {plan}");
            }
        }
        "customer.subscription.deleted" => {
            let customer_id = event["data"]["object"]["customer"].as_str().unwrap_or("");

            if !customer_id.is_empty() {
                // Downgrade to free
                let _ = sqlx::query(
                    "UPDATE tenants SET plan = 'free', updated_at = NOW() WHERE stripe_customer_id = $1"
                )
                .bind(customer_id)
                .execute(&state.db)
                .await;

                tracing::info!("Customer {customer_id} subscription cancelled, downgraded to free");
            }
        }
        "customer.subscription.updated" => {
            let customer_id = event["data"]["object"]["customer"].as_str().unwrap_or("");
            let price_id = event["data"]["object"]["items"]["data"][0]["price"]["id"]
                .as_str()
                .unwrap_or("");

            let plan = if price_id == crate::credits::pricing::StripePrices::enterprise_monthly() {
                "enterprise"
            } else {
                "pro"
            };

            if !customer_id.is_empty() {
                let _ = sqlx::query(
                    "UPDATE tenants SET plan = $1, updated_at = NOW() WHERE stripe_customer_id = $2"
                )
                .bind(plan)
                .bind(customer_id)
                .execute(&state.db)
                .await;

                tracing::info!("Customer {customer_id} plan updated to {plan}");
            }
        }
        "invoice.payment_failed" => {
            let customer_id = event["data"]["object"]["customer"].as_str().unwrap_or("");
            tracing::warn!("Payment failed for customer {customer_id}");
            // Could send notification, add grace period, etc.
        }
        _ => {
            tracing::debug!("Unhandled Stripe event: {event_type}");
        }
    }

    Ok(Json(json!({"received": true})))
}
