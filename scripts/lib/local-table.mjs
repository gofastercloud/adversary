// Creates the single table the API uses, with the same keys and GSI as infra/lib/adversary-stack.ts.
// Used by docker-compose bootstrap, `npm run local:table`, and the Dynalite-backed test.
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, UpdateTimeToLiveCommand } from '@aws-sdk/client-dynamodb';

export const tableDef = (TableName) => ({
  TableName, BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [['pk', 'S'], ['sk', 'S'], ['gsi1pk', 'S'], ['gsi1sk', 'S']].map(([AttributeName, AttributeType]) => ({ AttributeName, AttributeType })),
  KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }],
  GlobalSecondaryIndexes: [{ IndexName: 'gsi1', KeySchema: [{ AttributeName: 'gsi1pk', KeyType: 'HASH' }, { AttributeName: 'gsi1sk', KeyType: 'RANGE' }], Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: ['playerId', 'handle', 'points'] } }]
});

export async function ensureTable({ endpoint, table = 'adversary', region = 'ap-southeast-2' }) {
  const c = new DynamoDBClient({ endpoint, region, credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
  try { await c.send(new DescribeTableCommand({ TableName: table })); return 'exists'; } catch (e) { if (e.name !== 'ResourceNotFoundException') throw e; }
  await c.send(new CreateTableCommand(tableDef(table)));
  try { await c.send(new UpdateTimeToLiveCommand({ TableName: table, TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true } })); } catch { /* emulators may not implement TTL */ }
  return 'created';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
  console.log(`table ${process.env.TABLE_NAME || 'adversary'} @ ${endpoint}:`, await ensureTable({ endpoint, table: process.env.TABLE_NAME || 'adversary' }));
}
