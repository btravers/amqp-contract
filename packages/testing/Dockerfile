# Custom RabbitMQ image with rabbitmq_delayed_message_exchange plugin
FROM rabbitmq:3.13-management-alpine

# Download and install the delayed message exchange plugin
RUN wget https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v3.13.0/rabbitmq_delayed_message_exchange-3.13.0.ez \
    -O /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-3.13.0.ez

