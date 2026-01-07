# RabbitMQ Docker Image for Testing
# This image is used by testcontainers in integration tests
# Based on the official RabbitMQ image with management plugin

FROM rabbitmq:4.2.1-management-alpine

# The base image already includes:
# - RabbitMQ 4.2.1
# - Management plugin enabled
# - Alpine Linux base for smaller size

# Default credentials (can be overridden via environment variables)
ENV RABBITMQ_DEFAULT_USER=guest
ENV RABBITMQ_DEFAULT_PASS=guest

# Expose AMQP and Management ports
EXPOSE 5672 15672

# Health check
HEALTHCHECK --interval=5s --timeout=5s --retries=10 \
    CMD rabbitmq-diagnostics -q check_running

# Use the default entrypoint from the base image
