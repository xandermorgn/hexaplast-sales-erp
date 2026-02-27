import express from 'express';
import { requireSession } from '../middleware/sessionMiddleware.js';
import {
  createCategory,
  createProduct,
  deleteProduct,
  getCategories,
  getProducts,
  updateProduct,
  uploadProductImage,
} from '../controllers/productController.js';

const router = express.Router();

router.use(requireSession);

router.post('/categories', createCategory);
router.get('/categories', getCategories);

router.post('/machines', (req, _res, next) => {
  req.productType = 'machine';
  next();
}, uploadProductImage, createProduct);
router.get('/machines', (req, _res, next) => {
  req.productType = 'machine';
  next();
}, getProducts);
router.put('/machines/:id', (req, _res, next) => {
  req.productType = 'machine';
  next();
}, uploadProductImage, updateProduct);
router.delete('/machines/:id', (req, _res, next) => {
  req.productType = 'machine';
  next();
}, deleteProduct);

router.post('/spares', (req, _res, next) => {
  req.productType = 'spare';
  next();
}, uploadProductImage, createProduct);
router.get('/spares', (req, _res, next) => {
  req.productType = 'spare';
  next();
}, getProducts);
router.put('/spares/:id', (req, _res, next) => {
  req.productType = 'spare';
  next();
}, uploadProductImage, updateProduct);
router.delete('/spares/:id', (req, _res, next) => {
  req.productType = 'spare';
  next();
}, deleteProduct);

export default router;
