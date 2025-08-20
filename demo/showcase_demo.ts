import { Visualizer } from '../src/utils/visualizer';
import chalk from 'chalk';

console.log(chalk.bold.blue('🎯 AppInsights Detective - Chart Visualization Demo'));
console.log(chalk.dim('Showcasing new line chart capabilities alongside existing bar charts'));
console.log('═'.repeat(80));

// Demo 1: Time-series data with line chart
console.log(chalk.cyan('\n📈 TIME SERIES DATA - Line Chart'));
console.log(chalk.dim('Application response times over the day'));
const responseTimeData = [
  { time: '08:00', value: 120 },
  { time: '09:00', value: 145 },
  { time: '10:00', value: 180 },
  { time: '11:00', value: 95 },
  { time: '12:00', value: 220 },
  { time: '13:00', value: 170 },
  { time: '14:00', value: 150 }
];
Visualizer.displayChart(responseTimeData, 'line');

// Demo 2: Category data with bar chart  
console.log(chalk.cyan('\n📊 CATEGORY DATA - Bar Chart'));
console.log(chalk.dim('Request counts by endpoint'));
const endpointData = [
  { label: '/api/users', value: 1250 },
  { label: '/api/orders', value: 890 },
  { label: '/api/products', value: 2100 },
  { label: '/api/auth', value: 650 }
];
Visualizer.displayChart(endpointData, 'bar');

// Demo 3: Large dataset sparkline
console.log(chalk.cyan('\n✨ LARGE DATASET - Sparkline Trend'));
console.log(chalk.dim('Hourly user activity over the past 24 hours'));
const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
  label: `${hour.toString().padStart(2, '0')}:00`,
  value: Math.max(10, Math.sin((hour - 6) * Math.PI / 12) * 80 + 100 + Math.random() * 30)
}));
Visualizer.displayChart(hourlyActivity, 'line');

console.log(chalk.bold.green('\n✅ Chart Enhancement Complete!'));
console.log(chalk.dim('Features: ASCII line charts, Unicode sparklines, time-series detection, chart type selection'));