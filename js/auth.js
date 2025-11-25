// Login form handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('error-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');

        // Disable button during submission
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                // Successful login - redirect to dashboard
                window.location.href = '/dashboard.html';
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Log In';
        }
    });
}

// Signup form handler
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            age: parseInt(document.getElementById('age').value),
            gender: document.getElementById('gender').value,
            height_ft: parseInt(document.getElementById('height_ft').value),
            height_in: parseInt(document.getElementById('height_in').value),
            weight_lbs: parseFloat(document.getElementById('weight_lbs').value),
            goal_weight_lbs: parseFloat(document.getElementById('goal_weight_lbs').value),
            starting_weight_lbs: parseFloat(document.getElementById('weight_lbs').value)
        };

        const errorDiv = document.getElementById('error-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');

        // Basic validation
        if (formData.goal_weight_lbs >= formData.weight_lbs) {
            errorDiv.textContent = 'Goal weight must be less than current weight for weight loss';
            errorDiv.style.display = 'block';
            return;
        }

        if (formData.password.length < 6) {
            errorDiv.textContent = 'Password must be at least 6 characters';
            errorDiv.style.display = 'block';
            return;
        }

        // Disable button during submission
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                // Account created successfully - redirect to dashboard
                console.log('Account created, redirecting to dashboard...');
                window.location.href = '/dashboard.html';
            } else {
                errorDiv.textContent = data.error || 'Signup failed';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        } catch (error) {
            console.error('Signup error:', error);
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }
    });
}

// Check if user is already logged in (for index/signup pages)
async function checkAuthRedirect() {
    // Only run on login/signup pages
    const currentPage = window.location.pathname;
    if (currentPage === '/' || currentPage === '/index.html' || currentPage === '/signup.html') {
        try {
            const response = await fetch('/api/auth/check');
            const data = await response.json();

            if (data.authenticated) {
                // Already logged in, redirect to dashboard
                window.location.href = '/dashboard.html';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
    }
}

// Run auth check on page load
checkAuthRedirect();