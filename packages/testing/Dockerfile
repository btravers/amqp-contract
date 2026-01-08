# Custom RabbitMQ image with rabbitmq_delayed_message_exchange plugin
FROM rabbitmq:3.13-management-alpine

# Copy the delayed message exchange plugin from the build context
COPY plugins/rabbitmq_delayed_message_exchange-3.13.0.ez /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-3.13.0.ez

