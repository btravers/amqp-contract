import {
  HandleFailedOrdersHandler,
  HandleUrgentOrderHandler,
  NotifyOrderHandler,
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
    HandleFailedOrdersHandler,
  ],
  exports: [
    ProcessOrderHandler,
    NotifyOrderHandler,
    ShipOrderHandler,
    HandleUrgentOrderHandler,
    HandleFailedOrdersHandler,
  ],
})
export class HandlersModule {}
