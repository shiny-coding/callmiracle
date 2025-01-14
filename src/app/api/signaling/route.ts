import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

const clients = new Map<string, WebSocket>();

wss.on('connection', (ws) => {
  ws.on('message', (message: string) => {
    const data = JSON.parse(message);
    
    // Forward message to target peer
    const targetClient = clients.get(data.to);
    if (targetClient) {
      targetClient.send(JSON.stringify({
        type: data.type,
        payload: data.payload,
        from: data.from
      }));
    }
  });
}); 