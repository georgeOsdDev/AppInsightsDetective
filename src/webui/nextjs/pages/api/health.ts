import type { NextApiRequest, NextApiResponse } from 'next';

type HealthResponse = {
  status: string;
  timestamp: string;
  service: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (req.method === 'GET') {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'AppInsights Detective WebUI'
    });
  } else {
    res.status(405).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'Method not allowed'
    } as any);
  }
}