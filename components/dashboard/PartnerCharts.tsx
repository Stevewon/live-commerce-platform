'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SalesTrendData {
  date: string;
  sales: number;
  orders: number;
}

interface TopProduct {
  name: string;
  sales: number;
  orders: number;
  revenue: number;
}

interface OrderStatusData {
  status: string;
  count: number;
  label: string;
}

interface ChartData {
  salesTrend: SalesTrendData[];
  topProducts: TopProduct[];
  orderStatus: OrderStatusData[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#3B82F6',
  SHIPPING: '#8B5CF6',
  DELIVERED: '#10B981',
  CANCELLED: '#EF4444',
  REFUNDED: '#6B7280',
};

export default function PartnerCharts() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const res = await fetch('/api/partner/charts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('차트 데이터를 불러올 수 없습니다.');
      }

      const chartData = await res.json();
      setData(chartData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('차트 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
    
    // 60초마다 자동 갱신
    const interval = setInterval(fetchChartData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">⚠️ {error}</p>
        <button
          onClick={fetchChartData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 30일 매출 추이 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">📈 30일 매출 추이</h3>
          <button
            onClick={fetchChartData}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            🔄 새로고침
          </button>
        </div>
        {data.salesTrend && data.salesTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                stroke="#3B82F6"
                strokeWidth={2}
                name="매출 (원)"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                stroke="#10B981"
                strokeWidth={2}
                name="주문 수"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-400">
            <p>매출 데이터가 없습니다</p>
          </div>
        )}
      </div>

      {/* 주문 상태 분포 & TOP 10 상품 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 주문 상태 분포 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📊 주문 상태 분포</h3>
          {data.orderStatus && data.orderStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.orderStatus}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry: any) => `${entry.label}: ${entry.count}`}
                >
                  {data.orderStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400">
              <p>주문 데이터가 없습니다</p>
            </div>
          )}
        </div>

        {/* TOP 10 상품 (바 차트) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🏆 TOP 10 상품 (매출)</h3>
          {data.topProducts && data.topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topProducts.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(value: number) => `₩${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#3B82F6" name="매출" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400">
              <p>상품 데이터가 없습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* TOP 10 상품 테이블 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-bold text-gray-900 mb-4">🏆 TOP 10 인기 상품</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  순위
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상품명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  판매량
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주문 수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  매출
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.topProducts && data.topProducts.length > 0 ? (
                data.topProducts.slice(0, 10).map((product, index) => (
                  <tr key={index} className={index < 3 ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.sales.toLocaleString()}개
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.orders.toLocaleString()}건
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      ₩{product.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    아직 판매된 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
