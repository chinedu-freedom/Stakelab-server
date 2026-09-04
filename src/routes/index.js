import { Router } from 'express';
import { register, login, adminLogin, getMe, forgotPassword, verifyOtp, resetPassword, changePassword, resendEmailVerification, verifyEmailCode } from '../controllers/authController.js';
import { getStakingPlans, createStake, getUserStakes } from '../controllers/stakingController.js';
import { getPaymentMethods, createDeposit, getUserDeposits, oxapayWebhook, checkDepositStatus } from '../controllers/depositController.js';
import { createWithdrawal, getUserWithdrawals, addOrUpdateUserWallet, getUserWallets } from '../controllers/withdrawalController.js';
import { createTicket, getUserTickets, getTicketById, replyTicket, getAdminTickets, closeTicket, deleteTicketMessage, reopenTicket } from '../controllers/ticketController.js';
import {
  getUserDashboardData,
  getUserTransactions,
  updateUserData,
  getUserReferralsData,
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
  sendSecurityPinOtp,
  updateSecurityPin,
  getUserNotifications,
} from '../controllers/userController.js';
import {
  getAdminStats,
  getAdminNotifications,
  getAdminDeposits,
  approveDeposit,
  rejectDeposit,
  getAdminWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getAllStakingPlans,
  createStakingPlan,
  updateStakingPlan,
  deleteStakingPlan,
  updateEmailSettings,
  updateUserBalance,
  sendBatchNotification,
  getAdminUsers,
  getAdminUserDetail,
  getAdminTransactions,
  impersonateUser,
  updateAdminUserDetail,
  deleteAdminUser,
  getAdminStakingHistory,
  getReferralSettings,
  updateReferralSettings,
  adminChangePassword,
  globalAdminSearch,
  getGeneralSettings,
  updateGeneralSettings,
  getAppDownloadInfo,
  downloadAppApk,
  getLogoFaviconSettings,
  updateLogoFaviconSettings,
  getMaintenanceSettings,
  updateMaintenanceSettings,
  getCookiePolicySettings,
  updateCookiePolicySettings,
  adminChangeVerificationPassword,
  getSystemFeatures,
  updateSystemFeatures,
} from '../controllers/adminController.js';
import {
  getGiftCodes,
  createGiftCode,
  updateGiftCode,
  deleteGiftCode,
  getGiftCodeClaims,
  getUserGiftCodeClaims,
  claimGiftCode,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getCheckIns,
  updateCheckInsBulk,
  getUserDailyCheckinStatus,
  claimUserDailyCheckin,
  getSpinPrizes,
  createSpinPrize,
  updateSpinPrize,
  deleteSpinPrize,
  getSpinSettings,
  updateSpinSettings,
  getUserTasks,
  claimUserTask,
  getUserSpinInfo,
  spinUserWheel,
} from '../controllers/rewardController.js';
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
router.get('/public/logo-favicon', getLogoFaviconSettings);
router.get('/public/general-setting', getGeneralSettings);
router.get('/public/deposit-withdrawal-settings', getDepositWithdrawalSettings);
router.post('/admin/deposit-withdrawal-settings', authenticateAdmin, updateDepositWithdrawalSettings);
router.post('/oxapay-webhook', oxapayWebhook);
router.get('/oxapay-webhook', oxapayWebhook);

// User Protected Routes
router.get('/auth/me', authenticateUser, getMe);
router.post('/auth/send-email-verification', authenticateUser, resendEmailVerification);
router.post('/auth/verify-email', authenticateUser, verifyEmailCode);
router.get('/user/dashboard', authenticateUser, getUserDashboardData);
router.post('/user/data', authenticateUser, updateUserData);
router.post('/user/change-password', authenticateUser, changePassword);
router.post('/user/send-security-pin-otp', authenticateUser, sendSecurityPinOtp);
router.post('/user/update-security-pin', authenticateUser, updateSecurityPin);
router.get('/user/transactions', authenticateUser, getUserTransactions);
router.get('/user/referrals', authenticateUser, getUserReferralsData);
router.post('/staking/stake', authenticateUser, createStake);
router.get('/staking/my-stakes', authenticateUser, getUserStakes);
router.post('/deposits', authenticateUser, createDeposit);
router.post('/user/deposits', authenticateUser, createDeposit);
router.get('/deposits', authenticateUser, getUserDeposits);
router.get('/user/deposits', authenticateUser, getUserDeposits);
router.get('/deposits/status/:id', authenticateUser, checkDepositStatus);

router.post('/withdrawals', authenticateUser, createWithdrawal);
router.post('/user/withdrawals', authenticateUser, createWithdrawal);
router.get('/withdrawals', authenticateUser, getUserWithdrawals);
router.get('/user/withdrawals', authenticateUser, getUserWithdrawals);
router.post('/user/wallets', authenticateUser, addOrUpdateUserWallet);
router.get('/user/wallets', authenticateUser, getUserWallets);

// Ticket Routes (User)
router.post('/support/create', authenticateUser, createTicket);
router.get('/support/tickets', authenticateUser, getUserTickets);
router.get('/support/tickets/:id', authenticateUser, getTicketById);
router.post('/support/tickets/:id/reply', authenticateUser, replyTicket);
router.get('/user/notifications', authenticateUser, getUserNotifications);

// Admin Protected Routes
router.get('/admin/stats', authenticateAdmin, getAdminStats);
router.get('/admin/notifications', authenticateAdmin, getAdminNotifications);
router.get('/admin/deposits', authenticateAdmin, getAdminDeposits);
router.post('/admin/deposits/:id/approve', authenticateAdmin, approveDeposit);
router.post('/admin/deposits/:id/reject', authenticateAdmin, rejectDeposit);
router.get('/admin/withdrawals', authenticateAdmin, getAdminWithdrawals);
router.post('/admin/withdrawals/:id/approve', authenticateAdmin, approveWithdrawal);
router.post('/admin/withdrawals/:id/reject', authenticateAdmin, rejectWithdrawal);
router.get('/admin/staking-plans', authenticateAdmin, getAllStakingPlans);
router.post('/admin/staking-plans', authenticateAdmin, createStakingPlan);
router.put('/admin/staking-plans/:id', authenticateAdmin, updateStakingPlan);
router.delete('/admin/staking-plans/:id', authenticateAdmin, deleteStakingPlan);
router.post('/admin/settings/email', authenticateAdmin, updateEmailSettings);
router.post('/admin/settings/how-it-works', authenticateAdmin, updateHowItWorks);
router.post('/admin/settings/testimonials', authenticateAdmin, updateTestimonials);
router.post('/admin/settings/announcements', authenticateAdmin, updateAnnouncements);
router.post('/admin/settings/partners', authenticateAdmin, updatePartners);
router.post('/admin/settings/contact-links', authenticateAdmin, updateContactLinks);
router.post('/admin/settings/why-choose-us', authenticateAdmin, updateWhyChooseUs);
router.post('/admin/users/balance', authenticateAdmin, updateUserBalance);
router.post('/admin/users/send-notification', authenticateAdmin, sendBatchNotification);
router.post('/admin/users/:id/impersonate', authenticateAdmin, impersonateUser);
router.get('/admin/users', authenticateAdmin, getAdminUsers);
router.get('/admin/users/:id', authenticateAdmin, getAdminUserDetail);
router.put('/admin/users/:id', authenticateAdmin, updateAdminUserDetail);
router.delete('/admin/users/:id', authenticateAdmin, deleteAdminUser);
router.get('/admin/transactions', authenticateAdmin, getAdminTransactions);
router.get('/admin/staking-history', authenticateAdmin, getAdminStakingHistory);
router.get('/public/referral-settings', getReferralSettings);
router.get('/admin/referral-settings', authenticateAdmin, getReferralSettings);
router.post('/admin/referral-settings', authenticateAdmin, updateReferralSettings);
router.post('/admin/password', authenticateAdmin, adminChangePassword);
router.get('/admin/global-search', authenticateAdmin, globalAdminSearch);
router.get('/admin/general-setting', authenticateAdmin, getGeneralSettings);
router.post('/admin/general-setting', authenticateAdmin, updateGeneralSettings);
router.get('/user/app-download-info', getAppDownloadInfo);
router.get('/app-download', downloadAppApk);
router.get('/admin/logo-favicon', authenticateAdmin, getLogoFaviconSettings);
router.post('/admin/logo-favicon', authenticateAdmin, updateLogoFaviconSettings);
router.get('/public/maintenance-mode', getMaintenanceSettings);
router.get('/admin/maintenance-mode', authenticateAdmin, getMaintenanceSettings);
router.post('/admin/maintenance-mode', authenticateAdmin, updateMaintenanceSettings);
router.get('/public/cookie-policy', getCookiePolicySettings);
router.get('/admin/cookie-policy', authenticateAdmin, getCookiePolicySettings);
router.post('/admin/cookie-policy', authenticateAdmin, updateCookiePolicySettings);
router.post('/admin/verification-password', authenticateAdmin, adminChangeVerificationPassword);
router.get('/public/system-features', getSystemFeatures);
router.get('/admin/settings/system-features', authenticateAdmin, getSystemFeatures);
router.post('/admin/settings/system-features', authenticateAdmin, updateSystemFeatures);

// Reward & Gamification Routes
router.get('/admin/gift-codes', authenticateAdmin, getGiftCodes);
router.post('/admin/gift-codes', authenticateAdmin, createGiftCode);
router.put('/admin/gift-codes/:id', authenticateAdmin, updateGiftCode);
router.delete('/admin/gift-codes/:id', authenticateAdmin, deleteGiftCode);
router.get('/admin/gift-code-claims', authenticateAdmin, getGiftCodeClaims);
router.get('/user/gift-code-claims', authenticateUser, getUserGiftCodeClaims);
router.post('/user/claim-gift-code', authenticateUser, claimGiftCode);

router.get('/admin/tasks', authenticateAdmin, getTasks);
router.post('/admin/tasks', authenticateAdmin, createTask);
router.put('/admin/tasks/:id', authenticateAdmin, updateTask);
router.delete('/admin/tasks/:id', authenticateAdmin, deleteTask);

router.get('/admin/check-ins', authenticateAdmin, getCheckIns);
router.put('/admin/check-ins/bulk', authenticateAdmin, updateCheckInsBulk);
router.get('/user/daily-checkin-status', authenticateUser, getUserDailyCheckinStatus);
router.post('/user/claim-daily-checkin', authenticateUser, claimUserDailyCheckin);

router.get('/admin/spin-prizes', authenticateAdmin, getSpinPrizes);
router.post('/admin/spin-prizes', authenticateAdmin, createSpinPrize);
router.put('/admin/spin-prizes/:id', authenticateAdmin, updateSpinPrize);
router.delete('/admin/spin-prizes/:id', authenticateAdmin, deleteSpinPrize);
router.get('/admin/spin-settings', authenticateAdmin, getSpinSettings);
router.put('/admin/spin-settings', authenticateAdmin, updateSpinSettings);
router.post('/admin/spin-settings', authenticateAdmin, updateSpinSettings);

router.get('/public/system-features', getSystemFeatures);
router.post('/admin/settings/system-features', authenticateAdmin, updateSystemFeatures);

router.get('/user/tasks', authenticateUser, getUserTasks);
router.post('/user/claim-task', authenticateUser, claimUserTask);

router.get('/user/spin-info', authenticateUser, getUserSpinInfo);
router.post('/user/spin', authenticateUser, spinUserWheel);

// Ticket Routes (User)
router.post('/support/tickets/:id/close', authenticateUser, closeTicket);
router.post('/support/tickets/:id/reopen', authenticateUser, reopenTicket);
router.delete('/support/messages/:id', authenticateUser, deleteTicketMessage);

// Ticket Routes (Admin)
router.get('/admin/tickets', authenticateAdmin, getAdminTickets);
router.get('/admin/tickets/:id', authenticateAdmin, getTicketById);
router.post('/admin/tickets/:id/reply', authenticateAdmin, replyTicket);
router.post('/admin/tickets/:id/close', authenticateAdmin, closeTicket);
router.post('/admin/tickets/:id/reopen', authenticateAdmin, reopenTicket);
router.delete('/admin/support/messages/:id', authenticateAdmin, deleteTicketMessage);

export default router;
