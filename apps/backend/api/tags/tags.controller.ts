import { getSessionMiddleware } from '../../middleware';
import prisma from '../../prisma/prisma.ts';
import express from 'express';

const tags = express.Router();

tags.get('/', getSessionMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const data = await prisma.tag.findMany({
    where: { OR: [{ userId }, { global: true }] },
  });

  res.status(200).json(data);
});

export default tags;
