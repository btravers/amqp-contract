# Custom RabbitMQ image with rabbitmq_delayed_message_exchange plugin
FROM rabbitmq:3.13-management-alpine

# Install wget if not available, then download and install the delayed message exchange plugin
RUN apk add --no-cache wget && \
    wget https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v3.13.0/rabbitmq_delayed_message_exchange-3.13.0.ez \
    -O /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-3.13.0.ez

