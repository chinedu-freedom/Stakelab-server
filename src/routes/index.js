import { Router } from 'express';
import { register, login, adminLogin, getMe, forgotPassword, verifyOtp, resetPassword } from '../controllers/authController.js';
import { getStakingPlans, createStake, getUserStakes, claimStakeProfit } from '../controllers/stakingController.js';
import { getPaymentMethods, createDeposit, getUserDeposits } from '../controllers/depositController.js';
import { createWithdrawal, getUserWithdrawals, addOrUpdateUserWallet, getUserWallets } from '../controllers/withdrawalController.js';
import {
  getUserDashboardData,
  getUserTransactions,
  updateUserData,
  getPublicRecentActivity,
  getHowItWorks,
  updateHowItWorks,
  getTestimonials,
  updateTestimonials,
  getAnnouncements,
  updateAnnouncements,
  getPartners,
  updatePartners,
  getContactLinks,
  updateContactLinks,
  getWhyChooseUs,
  updateWhyChooseUs,
  getDepositWithdrawalSettings,
  updateDepositWithdrawalSettings,
} from '../controllers/userController.js';
import {
  getAdminStats,
  getAdminDeposits,
  approveDeposit,
  rejectDeposit,
  getAdminWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  createStakingPlan,
  updateEmailSettings,
  updateUserBalance,
} from '../controllers/adminController.js';
import { authenticateUser, authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// Public Routes
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/verify-otp', verifyOtp);
router.post('/auth/reset-password', resetPassword);
router.post('/admin/auth/login', adminLogin);
router.get('/staking/plans', getStakingPlans);
router.get('/payment-methods', getPaymentMethods);
router.get('/public/recent-activity', getPublicRecentActivity);
router.get('/public/how-it-works', getHowItWorks);
router.get('/public/testimonials', getTestimonials);
router.get('/public/announcements', getAnnouncements);
router.get('/public/partners', getPartners);
router.get('/public/contact-links', getContactLinks);
router.get('/public/why-choose-us', getWhyChooseUs);
router.get('/public/deposit-withdrawal-settings', getDepositWithdrawalSettings);
router.post('/admin/deposit-withdrawal-settings', authenticateAdmin, updateDepositWithdrawalSettings);

// User Protected Routes
router.get('/auth/me', authenticateUser, getMe);
router.get('/user/dashboard', authenticateUser, getUserDashboardData);
router.post('/user/data', authenticateUser, updateUserData);
router.get('/user/transactions', authenticateUser, getUserTransactions);
router.post('/staking/stake', authenticateUser, createStake);
router.get('/staking/my-stakes', authenticateUser, getUserStakes);
router.post('/staking/claim', authenticateUser, claimStakeProfit);
router.post('/deposits', authenticateUser, createDeposit);
router.get('/deposits', authenticateUser, getUserDeposits);
router.post('/withdrawals', authenticateUser, createWithdrawal);
router.get('/withdrawals', authenticateUser, getUserWithdrawals);
router.post('/user/wallets', authenticateUser, addOrUpdateUserWallet);
router.get('/user/wallets', authenticateUser, getUserWallets);

// Admin Protected Routes
router.get('/admin/stats', authenticateAdmin, getAdminStats);
router.get('/admin/deposits', authenticateAdmin, getAdminDeposits);
router.post('/admin/deposits/:id/approve', authenticateAdmin, approveDeposit);
router.post('/admin/deposits/:id/reject', authenticateAdmin, rejectDeposit);
router.get('/admin/withdrawals', authenticateAdmin, getAdminWithdrawals);
router.post('/admin/withdrawals/:id/approve', authenticateAdmin, approveWithdrawal);
router.post('/admin/withdrawals/:id/reject', authenticateAdmin, rejectWithdrawal);
router.post('/admin/staking-plans', authenticateAdmin, createStakingPlan);
router.post('/admin/settings/email', authenticateAdmin, updateEmailSettings);
router.post('/admin/settings/how-it-works', authenticateAdmin, updateHowItWorks);
router.post('/admin/settings/testimonials', authenticateAdmin, updateTestimonials);
router.post('/admin/settings/announcements', authenticateAdmin, updateAnnouncements);
router.post('/admin/settings/partners', authenticateAdmin, updatePartners);
router.post('/admin/settings/contact-links', authenticateAdmin, updateContactLinks);
router.post('/admin/settings/why-choose-us', authenticateAdmin, updateWhyChooseUs);
router.post('/admin/users/balance', authenticateAdmin, updateUserBalance);

export default router;
