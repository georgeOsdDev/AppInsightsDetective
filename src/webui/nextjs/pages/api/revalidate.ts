import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Disable static optimization by having an API route
  res.status(200).json({ revalidated: true });
}