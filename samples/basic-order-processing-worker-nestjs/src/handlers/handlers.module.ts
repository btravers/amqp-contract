import {
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
