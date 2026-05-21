import { storageService } from '../services/storageService';

async function test() {
  console.log('🟢 Starting Firebase storageService test');
  const sampleData = {
    productionBatches: [{ id: 'prod1', quantity: 100 }],
    stockBatches: [{ id: 'stock1', quantity: 50 }],
    clients: [{ id: 'client1', name: 'Test Client' }],
    sales: [{ id: 'sale1', amount: 200, clientId: 'client1' }],
    settings: { adminPasswordHash: 'testhash' },
  };

  await storageService.saveData(sampleData);
  console.log('✅ Data saved');

  const loaded = await storageService.loadData();
  console.log('📥 Loaded data:', JSON.stringify(loaded, null, 2));
}

test().catch((e) => console.error('❌ Test failed', e));
