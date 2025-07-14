#!/bin/bash

# CallMiracle Observability Stack Startup Script

echo "🚀 Starting CallMiracle Observability Stack..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start the observability stack
echo "📊 Starting observability services..."
docker-compose -f docker-compose.observability.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."

LOKI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ready)
TEMPO_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3200/ready)
GRAFANA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)

if [ "$LOKI_STATUS" = "200" ]; then
    echo "✅ Loki is ready (http://localhost:3100)"
else
    echo "⚠️ Loki may not be ready yet (Status: $LOKI_STATUS)"
fi

if [ "$TEMPO_STATUS" = "200" ]; then
    echo "✅ Tempo is ready (http://localhost:3200)"
else
    echo "⚠️ Tempo may not be ready yet (Status: $TEMPO_STATUS)"
fi

if [ "$GRAFANA_STATUS" = "200" ]; then
    echo "✅ Grafana is ready (http://localhost:3001)"
else
    echo "⚠️ Grafana may not be ready yet (Status: $GRAFANA_STATUS)"
fi

echo ""
echo "🎉 Observability stack is starting up!"
echo ""
echo "📱 Access your services:"
echo "  • Grafana Dashboard: http://localhost:3001 (admin/admin)"
echo "  • Loki (Logs): http://localhost:3100"
echo "  • Tempo (Traces): http://localhost:3200"
echo "  • OTEL Collector: http://localhost:4318"
echo ""
echo "🔧 To view logs: yarn observability:logs"
echo "🛑 To stop: yarn observability:down"
echo ""
echo "💡 Start your app with observability enabled:"
echo "   yarn dev:observability"
echo "" 