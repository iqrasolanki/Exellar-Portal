/**
 * Exellar.LLP Document Upload Portal
 * Integrated with Supabase Auth and role-based access
 */

(function () {
  const config = window.EXELLAR_CONFIG || {};
  const supabaseUrl = config.supabaseUrl || 'https://hxwctxkjujiyxmhyvwdw.supabase.co';
  const supabaseAnonKey = config.supabaseAnonKey || 'PASTE_SUPABASE_ANON_KEY_HERE';

  const state = {
    session: null,
    profile: null,
    authView: 'login',
    mySubmissions: [],
    allProfiles: [],
    allSubmissions: [],
    allFiles: [],
    loading: false,
  };

  let supabase = null;

  function init() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    initializeQrHelpers();
    initializeMobileNavigation();
    initializeShareModal();

    if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes('PASTE_')) {
      showPortalMessage(
        'Supabase is not fully configured yet. Update the Supabase URL/anon key in the browser config, then reload the page.',
        'warning'
      );
    }

    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });

      supabase.auth.onAuthStateChange(async (_event, session) => {
        state.session = session;
        if (!session) {
          state.profile = null;
          state.mySubmissions = [];
          state.allProfiles = [];
          state.allSubmissions = [];
          state.allFiles = [];
        }
        renderAuthenticatedViews();
        renderAuthPanel();
        if (session) {
          await bootAuthState();
        }
      });

      bindGlobalEvents();
      bootAuthState();
    } else {
      showPortalMessage('Supabase JavaScript SDK is unavailable. Please verify the browser script loads correctly.', 'error');
    }
  }

  function initializeQrHelpers() {
    const currentOrigin = window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'https://exellar-portal.vercel.app';

    const qrTarget = currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')
      ? 'https://exellar-portal.vercel.app'
      : currentOrigin;

    const modalQrImg = document.getElementById('modal-qr-img');
    const modalShareLink = document.getElementById('modal-share-link');
    const modalOpenBtn = document.getElementById('modal-open-btn');

    if (modalQrImg) {
      modalQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrTarget)}`;
    }

    if (modalShareLink) {
      modalShareLink.href = qrTarget;
      modalShareLink.textContent = qrTarget;
    }

    if (modalOpenBtn) {
      modalOpenBtn.href = qrTarget;
    }
  }

  function initializeMobileNavigation() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuClose = document.getElementById('mobile-menu-close');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    window.openMobileMenu = function () {
      if (mobileMenu) {
        mobileMenu.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
    };

    window.closeMobileMenu = function () {
      if (mobileMenu) {
        mobileMenu.classList.add('hidden');
        document.body.style.overflow = '';
      }
    };

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', window.openMobileMenu);
    if (mobileMenuClose) mobileMenuClose.addEventListener('click', window.closeMobileMenu);

    mobileNavLinks.forEach((link) => {
      link.addEventListener('click', window.closeMobileMenu);
    });

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach((link) => {
      link.addEventListener('click', function () {
        navLinks.forEach((item) => item.classList.remove('active'));
        this.classList.add('active');
      });
    });
  }

  function initializeShareModal() {
    const shareModal = document.getElementById('share-modal');

    window.toggleShareModal = function () {
      if (!shareModal) return;
      if (shareModal.classList.contains('hidden')) {
        shareModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      } else {
        shareModal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    };

    if (shareModal) {
      shareModal.addEventListener('click', (event) => {
        if (event.target === shareModal) {
          window.toggleShareModal();
        }
      });
    }

    window.copyModalLink = function () {
      const linkText = document.getElementById('modal-share-link')?.href || window.location.origin;
      copyToClipboard(linkText);
    };

    window.copyToClipboard = function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => showToast())
          .catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    };

    function fallbackCopy(text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        showToast();
      } catch (error) {
        console.error('Copy failed', error);
      }

      document.body.removeChild(textArea);
    }

    function showToast() {
      const toast = document.getElementById('share-toast');
      if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2500);
      }
    }
  }

  function bindGlobalEvents() {
    document.addEventListener('click', async (event) => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;

      const { action } = trigger.dataset;

      if (action === 'switch-auth-view') {
        state.authView = trigger.dataset.view;
        renderAuthPanel();
        return;
      }

      if (action === 'logout') {
        await handleLogout();
        return;
      }

      if (action === 'refresh-data') {
        await bootAuthState();
        return;
      }

      if (action === 'toggle-role') {
        const targetUserId = trigger.dataset.userId;
        const targetRole = trigger.dataset.role === 'ADMIN' ? 'USER' : 'ADMIN';
        await updateUserRole(targetUserId, targetRole);
        return;
      }

      if (action === 'toggle-status') {
        const targetUserId = trigger.dataset.userId;
        const nextStatus = trigger.dataset.status === 'true';
        await updateUserStatus(targetUserId, !nextStatus);
        return;
      }

      if (action === 'create-submission') {
        await createSubmissionFromForm();
        return;
      }
    });

    document.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (form.dataset.form === 'register') {
        event.preventDefault();
        await handleRegister(form);
      }

      if (form.dataset.form === 'login') {
        event.preventDefault();
        await handleLogin(form);
      }

      if (form.dataset.form === 'forgot-password') {
        event.preventDefault();
        await handleForgotPassword(form);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const shareModal = document.getElementById('share-modal');
        const mobileMenu = document.getElementById('mobile-menu');

        if (shareModal && !shareModal.classList.contains('hidden')) {
          window.toggleShareModal();
        }

        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
          window.closeMobileMenu();
        }
      }
    });
  }

  async function bootAuthState() {
    if (!supabase) return;

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('getSession failed', error);
      showPortalMessage('Unable to read the current session. Please reload the page.', 'error');
      return;
    }

    state.session = session;

    if (!session) {
      state.profile = null;
      state.mySubmissions = [];
      state.allProfiles = [];
      state.allSubmissions = [];
      state.allFiles = [];
      renderAuthenticatedViews();
      renderAuthPanel();
      return;
    }

    await loadProfile();
    await loadMySubmissions();

    if (state.profile && state.profile.role === 'ADMIN') {
      await loadAdminData();
    }

    renderAuthenticatedViews();
    renderAuthPanel();
  }

  async function loadProfile() {
    if (!supabase || !state.session) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', state.session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Profile fetch failed', error);
      showPortalMessage('Unable to load the user profile. Please try again.', 'error');
      return;
    }

    if (!data) {
      const fallbackProfile = {
        id: state.session.user.id,
        email: state.session.user.email,
        full_name: state.session.user.user_metadata?.full_name || state.session.user.email.split('@')[0],
        role: 'USER',
        is_active: true,
      };

      state.profile = fallbackProfile;
      showPortalMessage('Profile data is not yet available in the database. A user profile will be created automatically after the first valid Supabase auth event.', 'warning');
      return;
    }

    state.profile = data;
  }

  async function loadMySubmissions() {
    if (!supabase || !state.session) {
      state.mySubmissions = [];
      return;
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', state.session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Submission fetch failed', error);
      return;
    }

    state.mySubmissions = data || [];
  }

  async function loadAdminData() {
    if (!supabase || !state.session || !state.profile || state.profile.role !== 'ADMIN') return;

    const [profiles, submissions, files] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('uploaded_files').select('*').order('created_at', { ascending: false }),
    ]);

    if (profiles.error) {
      console.error('Profiles fetch failed', profiles.error);
    } else {
      state.allProfiles = profiles.data || [];
    }

    if (submissions.error) {
      console.error('Submissions fetch failed', submissions.error);
    } else {
      state.allSubmissions = submissions.data || [];
    }

    if (files.error) {
      console.error('Uploaded file fetch failed', files.error);
    } else {
      state.allFiles = files.data || [];
    }
  }

  async function handleRegister(form) {
    if (!supabase) {
      showPortalMessage('Supabase has not been configured.', 'error');
      return;
    }

    const fullName = form.full_name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirm_password.value;

    if (!fullName || !email || !password || !confirmPassword) {
      showPortalMessage('Please complete every registration field.', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showPortalMessage('Please enter a valid email address.', 'error');
      return;
    }

    if (password.length < 8) {
      showPortalMessage('Password must be at least 8 characters long.', 'error');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      showPortalMessage('Password must include at least one uppercase letter and one number.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showPortalMessage('Password and confirm password must match.', 'error');
      return;
    }

    state.loading = true;
    renderAuthPanel();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    state.loading = false;
    renderAuthPanel();

    if (error) {
      console.error('Sign-up failed', error);
      showPortalMessage(error.message || 'Registration failed. Please try again.', 'error');
      return;
    }

    showPortalMessage(
      'Registration successful. If email verification is enabled, check your inbox to verify your account before signing in.',
      'success'
    );

    form.reset();
    state.authView = 'login';
    renderAuthPanel();
  }

  async function handleLogin(form) {
    if (!supabase) {
      showPortalMessage('Supabase has not been configured.', 'error');
      return;
    }

    const email = form.email.value.trim();
    const password = form.password.value;

    if (!email || !password) {
      showPortalMessage('Email and password are required to sign in.', 'error');
      return;
    }

    state.loading = true;
    renderAuthPanel();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    state.loading = false;
    renderAuthPanel();

    if (error) {
      console.error('Login failed', error);
      showPortalMessage(error.message || 'Unable to sign in. Please try again.', 'error');
      return;
    }

    showPortalMessage('Signed in successfully.', 'success');
    await bootAuthState();
  }

  async function handleForgotPassword(form) {
    if (!supabase) {
      showPortalMessage('Supabase has not been configured.', 'error');
      return;
    }

    const email = form.email.value.trim();

    if (!email) {
      showPortalMessage('Please enter your email address.', 'error');
      return;
    }

    state.loading = true;
    renderAuthPanel();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });

    state.loading = false;
    renderAuthPanel();

    if (error) {
      console.error('Password reset request failed', error);
      showPortalMessage(error.message || 'Unable to send the reset email.', 'error');
      return;
    }

    showPortalMessage('Password reset instructions have been sent to your email.', 'success');
    form.reset();
    state.authView = 'login';
    renderAuthPanel();
  }

  async function handleLogout() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out failed', error);
      showPortalMessage('Unable to sign out right now.', 'error');
      return;
    }

    state.session = null;
    state.profile = null;
    state.mySubmissions = [];
    state.allProfiles = [];
    state.allSubmissions = [];
    state.allFiles = [];

    renderAuthenticatedViews();
    renderAuthPanel();
    showPortalMessage('You have been signed out.', 'success');
  }

  async function createSubmissionFromForm() {
    const form = document.getElementById('submission-form');
    if (!form || !state.session) return;

    const title = form.title.value.trim();
    const submissionType = form.submission_type.value;
    const notes = form.notes.value.trim();
    const sourceLink = form.source_link.value.trim();

    if (!title) {
      showPortalMessage('A submission title is required.', 'error');
      return;
    }

    const { error } = await supabase
      .from('submissions')
      .insert([
        {
          user_id: state.session.user.id,
          title,
          submission_type: submissionType,
          notes,
          source_link: sourceLink,
          status: 'submitted',
          metadata: {
            source: 'portal',
            created_by: state.session.user.email,
          },
        },
      ]);

    if (error) {
      console.error('Submission insert failed', error);
      showPortalMessage(error.message || 'Unable to create this submission.', 'error');
      return;
    }

    form.reset();
    await loadMySubmissions();
    if (state.profile?.role === 'ADMIN') {
      await loadAdminData();
    }

    renderAuthenticatedViews();
    showPortalMessage('Submission recorded successfully.', 'success');
  }

  async function updateUserRole(userId, nextRole) {
    if (!supabase || !state.profile || state.profile.role !== 'ADMIN') {
      showPortalMessage('Only administrators can change roles.', 'error');
      return;
    }

    const { error } = await supabase.rpc('admin_set_profile_role', {
      target_user_id: userId,
      new_role: nextRole,
    });

    if (error) {
      console.error('Update role failed', error);
      showPortalMessage(error.message || 'Unable to update the role.', 'error');
      return;
    }

    await loadAdminData();
    renderAdminDashboard();
    showPortalMessage(`User role updated to ${nextRole}.`, 'success');
  }

  async function updateUserStatus(userId, nextIsActive) {
    if (!supabase || !state.profile || state.profile.role !== 'ADMIN') {
      showPortalMessage('Only administrators can update account status.', 'error');
      return;
    }

    const { error } = await supabase.rpc('admin_set_account_status', {
      target_user_id: userId,
      is_active: nextIsActive,
    });

    if (error) {
      console.error('Update status failed', error);
      showPortalMessage(error.message || 'Unable to update account status.', 'error');
      return;
    }

    await loadAdminData();
    renderAdminDashboard();
    showPortalMessage(`Account status updated to ${nextIsActive ? 'active' : 'inactive'}.`, 'success');
  }

  function renderAuthenticatedViews() {
    const authPanel = document.getElementById('auth-panel');
    const userDashboard = document.getElementById('user-dashboard');
    const adminDashboard = document.getElementById('admin-dashboard');

    if (!state.session) {
      authPanel.classList.remove('hidden');
      authPanel.innerHTML = '';
      userDashboard.classList.add('hidden');
      adminDashboard.classList.add('hidden');
      renderAuthPanel();
      return;
    }

    authPanel.classList.add('hidden');
    userDashboard.classList.remove('hidden');
    renderUserDashboard();

    if (state.profile && state.profile.role === 'ADMIN') {
      adminDashboard.classList.remove('hidden');
      renderAdminDashboard();
    } else {
      adminDashboard.classList.add('hidden');
    }

    renderAuthActions();
  }

  function renderAuthPanel() {
    const authPanel = document.getElementById('auth-panel');

    if (!authPanel) return;

    if (state.session) {
      authPanel.classList.add('hidden');
      authPanel.innerHTML = '';
      return;
    }

    authPanel.classList.remove('hidden');

    const isLoading = state.loading;
    const loginActive = state.authView === 'login';
    const registerActive = state.authView === 'register';
    const forgotActive = state.authView === 'forgot';

    authPanel.innerHTML = `
      <div class="brand-card p-6 sm:p-8">
        <div class="flex flex-wrap gap-2 mb-6">
          <button data-action="switch-auth-view" data-view="login" class="flex-1 min-w-[120px] rounded-xl px-4 py-2 text-sm font-semibold ${loginActive ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-700'}">
            Login
          </button>
          <button data-action="switch-auth-view" data-view="register" class="flex-1 min-w-[120px] rounded-xl px-4 py-2 text-sm font-semibold ${registerActive ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-700'}">
            Register
          </button>
          <button data-action="switch-auth-view" data-view="forgot" class="flex-1 min-w-[120px] rounded-xl px-4 py-2 text-sm font-semibold ${forgotActive ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-700'}">
            Forgot Password
          </button>
        </div>

        ${loginActive ? `
          <form data-form="login" class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input name="email" type="email" required class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="name@example.com">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <input name="password" type="password" required class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="Enter your password">
            </div>
            <button type="submit" class="btn-exellar-primary ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}" ${isLoading ? 'disabled' : ''}>
              ${isLoading ? 'Signing In...' : 'Login'}
            </button>
          </form>
        ` : ''}

        ${registerActive ? `
          <form data-form="register" class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
              <input name="full_name" type="text" required class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="Your full name">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input name="email" type="email" required class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="name@example.com">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <input name="password" type="password" required class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="Minimum 8 characters">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Confirm Password</label>
              <input name="confirm_password" type="password" required class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="Confirm password">
            </div>
            <button type="submit" class="btn-exellar-primary ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}" ${isLoading ? 'disabled' : ''}>
              ${isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        ` : ''}

        ${forgotActive ? `
          <form data-form="forgot-password" class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input name="email" type="email" required class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="name@example.com">
            </div>
            <button type="submit" class="btn-exellar-primary ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}" ${isLoading ? 'disabled' : ''}>
              ${isLoading ? 'Sending Reset Email...' : 'Send Reset Email'}
            </button>
          </form>
        ` : ''}
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function renderUserDashboard() {
    const userDashboard = document.getElementById('user-dashboard');
    if (!userDashboard) return;

    const roleLabel = state.profile?.role || 'USER';

    userDashboard.innerHTML = `
      <div class="brand-card p-6 sm:p-8">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#0077C6]">Authenticated User</p>
            <h3 class="mt-1 text-2xl font-display font-extrabold text-[#0B2545]">${escapeHtml(state.profile?.full_name || state.session?.user?.email || 'Portal User')}</h3>
            <p class="text-slate-600">${escapeHtml(state.session?.user?.email || '')}</p>
          </div>
          <span class="inline-flex items-center rounded-full bg-[#E6F2FF] px-3 py-1 text-sm font-semibold text-[#0077C6]">
            ${roleLabel}
          </span>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Account Status</p>
            <p class="mt-2 text-lg font-bold text-[#0B2545]">${state.profile?.is_active === false ? 'Inactive' : 'Active'}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Portal Access</p>
            <p class="mt-2 text-lg font-bold text-[#0B2545]">Submit and manage your own information</p>
          </div>
        </div>
      </div>

      <div class="brand-card mt-6 p-6 sm:p-8">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h4 class="font-display text-xl font-bold text-[#0B2545]">Submit Information</h4>
          <button data-action="refresh-data" class="btn-exellar-secondary !min-h-[42px] !py-1.5 !text-sm !rounded-xl border-[#0077C6]/30">
            Refresh
          </button>
        </div>

        <form id="submission-form" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Submission title</label>
            <input name="title" type="text" required class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="Example: Invoice upload request">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Submission type</label>
            <select name="submission_type" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none">
              <option value="tax_invoice">Tax Invoice</option>
              <option value="meter_reading">Meter Reading</option>
              <option value="drawing_details">Drawing Details</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Source link</label>
            <input name="source_link" type="url" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="https://forms.gle/...">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
            <textarea name="notes" rows="4" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-[#0077C6] focus:outline-none" placeholder="Add details about your request or uploaded documents."></textarea>
          </div>
          <button type="button" data-action="create-submission" class="btn-exellar-primary">
            Create Submission Record
          </button>
        </form>
      </div>

      <div class="brand-card mt-6 p-6 sm:p-8">
        <h4 class="font-display text-xl font-bold text-[#0B2545] mb-4">My Submissions</h4>
        ${state.mySubmissions.length ? `
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead>
                <tr class="border-b border-slate-200 text-slate-600">
                  <th class="py-2 pr-4 font-semibold">Title</th>
                  <th class="py-2 pr-4 font-semibold">Type</th>
                  <th class="py-2 pr-4 font-semibold">Status</th>
                  <th class="py-2 pr-4 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                ${state.mySubmissions.map((item) => `
                  <tr class="border-b border-slate-100">
                    <td class="py-3 pr-4 font-medium text-[#0B2545]">${escapeHtml(item.title)}</td>
                    <td class="py-3 pr-4">${escapeHtml(item.submission_type)}</td>
                    <td class="py-3 pr-4"><span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">${escapeHtml(item.status)}</span></td>
                    <td class="py-3 pr-4">${formatDate(item.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            No submissions have been recorded yet. Use the form above or the existing portal upload cards to submit your information.
          </div>
        `}
      </div>
    `;
  }

  function renderAdminDashboard() {
    const adminDashboard = document.getElementById('admin-dashboard');
    if (!adminDashboard) return;

    adminDashboard.innerHTML = `
      <div class="brand-card p-6 sm:p-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#0077C6]">Admin Dashboard</p>
            <h3 class="mt-1 text-2xl font-display font-extrabold text-[#0B2545]">Portal Management</h3>
          </div>
          <button data-action="refresh-data" class="btn-exellar-secondary !min-h-[42px] !py-1.5 !text-sm !rounded-xl border-[#0077C6]/30">
            Refresh Data
          </button>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-3">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Registered Users</p>
            <p class="mt-2 text-2xl font-bold text-[#0B2545]">${state.allProfiles.length}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Admin Accounts</p>
            <p class="mt-2 text-2xl font-bold text-[#0B2545]">${state.allProfiles.filter((profile) => profile.role === 'ADMIN').length}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Submission Records</p>
            <p class="mt-2 text-2xl font-bold text-[#0B2545]">${state.allSubmissions.length}</p>
          </div>
        </div>
      </div>

      <div class="brand-card mt-6 p-6 sm:p-8">
        <h4 class="font-display text-xl font-bold text-[#0B2545] mb-4">User Management</h4>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-slate-600">
                <th class="py-2 pr-4 font-semibold">Full Name</th>
                <th class="py-2 pr-4 font-semibold">Email</th>
                <th class="py-2 pr-4 font-semibold">Registered</th>
                <th class="py-2 pr-4 font-semibold">Role</th>
                <th class="py-2 pr-4 font-semibold">Status</th>
                <th class="py-2 pr-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              ${state.allProfiles.length ? state.allProfiles.map((profile) => `
                <tr class="border-b border-slate-100 align-top">
                  <td class="py-3 pr-4 font-medium text-[#0B2545]">${escapeHtml(profile.full_name || '—')}</td>
                  <td class="py-3 pr-4">${escapeHtml(profile.email || '—')}</td>
                  <td class="py-3 pr-4">${formatDate(profile.created_at)}</td>
                  <td class="py-3 pr-4">
                    <span class="rounded-full ${profile.role === 'ADMIN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'} px-2.5 py-1 text-xs font-semibold">
                      ${escapeHtml(profile.role)}
                    </span>
                  </td>
                  <td class="py-3 pr-4">
                    <span class="rounded-full ${profile.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} px-2.5 py-1 text-xs font-semibold">
                      ${profile.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td class="py-3 pr-4">
                    <div class="flex flex-wrap gap-2">
                      <button data-action="toggle-role" data-user-id="${profile.id}" data-role="${profile.role}" class="rounded-lg border border-[#0077C6]/30 bg-[#F0F7FF] px-2.5 py-1.5 text-xs font-semibold text-[#0077C6]">
                        ${profile.role === 'ADMIN' ? 'Demote to USER' : 'Promote to ADMIN'}
                      </button>
                      <button data-action="toggle-status" data-user-id="${profile.id}" data-status="${profile.is_active}" class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                        ${profile.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" class="py-6 text-slate-600">No registered users found.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <div class="brand-card mt-6 p-6 sm:p-8">
        <h4 class="font-display text-xl font-bold text-[#0B2545] mb-4">All Submissions</h4>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-slate-600">
                <th class="py-2 pr-4 font-semibold">Title</th>
                <th class="py-2 pr-4 font-semibold">User</th>
                <th class="py-2 pr-4 font-semibold">Type</th>
                <th class="py-2 pr-4 font-semibold">Status</th>
                <th class="py-2 pr-4 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              ${state.allSubmissions.length ? state.allSubmissions.map((submission) => `
                <tr class="border-b border-slate-100 align-top">
                  <td class="py-3 pr-4 font-medium text-[#0B2545]">${escapeHtml(submission.title)}</td>
                  <td class="py-3 pr-4">${escapeHtml(getEmailForUser(submission.user_id))}</td>
                  <td class="py-3 pr-4">${escapeHtml(submission.submission_type)}</td>
                  <td class="py-3 pr-4"><span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">${escapeHtml(submission.status)}</span></td>
                  <td class="py-3 pr-4">${formatDate(submission.created_at)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5" class="py-6 text-slate-600">No submissions available.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAuthActions() {
    const desktopAuthActions = document.getElementById('desktop-auth-actions');
    const mobileAuthActions = document.getElementById('mobile-auth-actions');

    if (!desktopAuthActions || !mobileAuthActions) return;

    if (!state.session) {
      desktopAuthActions.innerHTML = `
        <button data-action="switch-auth-view" data-view="login" class="btn-exellar-secondary !min-h-[38px] !py-1.5 !px-3.5 !text-xs !rounded-xl border-[#0077C6]/30">
          Login
        </button>
        <button data-action="switch-auth-view" data-view="register" class="btn-exellar-primary !min-h-[38px] !py-1.5 !px-3.5 !text-xs !rounded-xl">
          Register
        </button>
      `;
      mobileAuthActions.innerHTML = `
        <button data-action="switch-auth-view" data-view="login" class="text-left py-3 border-b border-slate-100 text-slate-800 font-semibold">Login</button>
        <button data-action="switch-auth-view" data-view="register" class="text-left py-3 border-b border-slate-100 text-slate-800 font-semibold">Register</button>
      `;
      return;
    }

    const isAdmin = state.profile?.role === 'ADMIN';

    desktopAuthActions.innerHTML = `
      ${isAdmin ? `
        <button data-action="switch-auth-view" data-view="login" class="btn-exellar-secondary !min-h-[38px] !py-1.5 !px-3.5 !text-xs !rounded-xl border-[#0077C6]/30">
          Admin Dashboard
        </button>
      ` : ''}
      <button data-action="logout" class="btn-exellar-secondary !min-h-[38px] !py-1.5 !px-3.5 !text-xs !rounded-xl border-[#0077C6]/30">
        Logout
      </button>
    `;

    mobileAuthActions.innerHTML = `
      ${isAdmin ? `
        <button class="text-left py-3 border-b border-slate-100 text-[#0077C6] font-semibold">Admin Dashboard</button>
      ` : ''}
      <button data-action="logout" class="text-left py-3 border-b border-slate-100 text-slate-800 font-semibold">Logout</button>
    `;
  }

  function getEmailForUser(userId) {
    const user = state.allProfiles.find((profile) => profile.id === userId);
    return user ? user.email : userId;
  }

  function formatDate(dateValue) {
    if (!dateValue) return '—';

    try {
      return new Date(dateValue).toLocaleString();
    } catch (error) {
      return '—';
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showPortalMessage(message, type) {
    const messageBox = document.getElementById('portal-message');
    if (!messageBox) return;

    const styles = {
      success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      error: 'border-red-200 bg-red-50 text-red-700',
      warning: 'border-amber-200 bg-amber-50 text-amber-700',
      info: 'border-slate-200 bg-slate-50 text-slate-700',
    };

    messageBox.className = `rounded-2xl border p-4 shadow-sm ${styles[type] || styles.info}`;
    messageBox.textContent = message;
    messageBox.classList.remove('hidden');
  }

  document.addEventListener('DOMContentLoaded', init);
})();

