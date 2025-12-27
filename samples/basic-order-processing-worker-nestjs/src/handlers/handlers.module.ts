import { Module } from "@nestjs/common";
import {
  HandleUrgentOrderHandler,
  NotifyOrderHandler,
  ProcessAnalyticsHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./index.js";

@Module({
  providers: [
    ProcessOrderHandler,
    NotifyOrderHandler,
    ShipOrderHandler,
    HandleUrgentOrderHandler,
    ProcessAnalyticsHandler,
  ],
  exports: [
    ProcessOrderHandler,
    NotifyOrderHandler,
    ShipOrderHandler,
    HandleUrgentOrderHandler,
    ProcessAnalyticsHandler,
  ],
})
export class HandlersModule {}

