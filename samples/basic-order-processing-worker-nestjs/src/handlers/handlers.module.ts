import {
  HandleFailedOrdersHandler,
  HandleUrgentOrderHandler,
  NotifyOrderHandler,
  ProcessAnalyticsHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./index.js";
import { Module } from "@nestjs/common";

@Module({
  providers: [
    ProcessOrderHandler,
    NotifyOrderHandler,
    ShipOrderHandler,
    HandleUrgentOrderHandler,
    ProcessAnalyticsHandler,
    HandleFailedOrdersHandler,
  ],
  exports: [
    ProcessOrderHandler,
    NotifyOrderHandler,
    ShipOrderHandler,
    HandleUrgentOrderHandler,
    ProcessAnalyticsHandler,
    HandleFailedOrdersHandler,
  ],
})
export class HandlersModule {}
