import { Visualizer } from '../src/utils/visualizer';

console.log('\n🎯 AppInsights Detective - Line Chart Demo\n');

// Test 1: Time series data (should auto-detect as line chart)
console.log('1. 📈 Time Series Data (Auto-detected as Line Chart):');
const timeSeriesData = [
  { time: '2024-01-01T10:00:00Z', value: 150 },
  { time: '2024-01-01T11:00:00Z', value: 180 },
  { time: '2024-01-01T12:00:00Z', value: 120 },
  { time: '2024-01-01T13:00:00Z', value: 220 },
  { time: '2024-01-01T14:00:00Z', value: 190 },
];
Visualizer.displayChart(timeSeriesData, 'line');

// Test 2: Small numeric dataset (should show ASCII line chart)
console.log('\n2. 📊 Small Dataset (ASCII Line Chart):');
const smallData = [
  { label: 'Jan', value: 100 },
  { label: 'Feb', value: 150 },
  { label: 'Mar', value: 80 },
  { label: 'Apr', value: 200 },
  { label: 'May', value: 175 }
];
Visualizer.displayChart(smallData, 'line');

// Test 3: Large dataset (should show sparkline)
console.log('\n3. ✨ Large Dataset (Sparkline):');
const largeData = Array.from({ length: 30 }, (_, i) => ({
  label: `Point ${i + 1}`,
  value: Math.sin(i * 0.3) * 50 + 100 + Math.random() * 20
}));
Visualizer.displayChart(largeData, 'line');

// Test 4: Bar chart (preserved functionality)
console.log('\n4. 📊 Bar Chart (Preserved Functionality):');
Visualizer.displayChart(smallData, 'bar');

console.log('\n✅ Demo Complete! Line chart enhancement is working.\n');