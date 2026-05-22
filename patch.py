import sys

file_path = r"c:\Users\hecsb\OneDrive\Desktop\Learning_platform - 2\assets\js\ui.js"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace 1: Login
target1 = '''                    <p class="auth-footer">Don't have an account? <a href="#" data-link="onboarding">Sign Up</a></p>'''
replacement1 = '''                    ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `
                    <button type="button" class="btn btn-secondary w-100 btn-snake mt-10" id="dev-auto-login" style="margin-top: 10px; border: 2px dashed #6366f1;">
                        <span></span><span></span><span></span><span></span>
                        🛠️ DEV: Auto-Login Test User
                    </button>
                    ` : ''}

                    <p class="auth-footer">Don't have an account? <a href="#" data-link="onboarding">Sign Up</a></p>'''

# Replace 2: Signup
target2 = '''                    <p class="auth-footer">Already have an account? <a href="#" data-link="login">Login</a></p>'''
replacement2 = '''                    ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `
                    <button type="button" class="btn btn-secondary w-100 btn-snake mt-10" id="dev-auto-signup" style="margin-top: 10px; border: 2px dashed #6366f1;">
                        <span></span><span></span><span></span><span></span>
                        🛠️ DEV: Auto-Signup Test User
                    </button>
                    ` : ''}

                    <p class="auth-footer">Already have an account? <a href="#" data-link="login">Login</a></p>'''

# Replace 3: Listener
target3 = '''        form.addEventListener('submit', async (e) => {'''
replacement3 = '''        // DEV Auto Auth Listener (Localhost Only)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const devBtn = document.getElementById(type === 'login' ? 'dev-auto-login' : 'dev-auto-signup');
            devBtn?.addEventListener('click', async () => {
                UI.showLoader();
                const testEmail = 'dev.test.user@edtechra.local';
                const testPass = 'DevTest123!';
                const tempRole = localStorage.getItem('edtechra_role') || 'admin';
                
                let result;
                if (type === 'login') {
                    result = await Auth.signIn(testEmail, testPass);
                    if (result.error && (result.error.message.includes('Invalid login credentials') || result.error.message.includes('not found') || result.error.status === 400 || (result.error.message || '').includes('rate limit') === false)) {
                        UI.showToast('Test user missing, attempting signup...', 'info');
                        result = await Auth.signUp(testEmail, testPass, 'Dev Auto Tester', tempRole);
                    }
                } else {
                    result = await Auth.signUp(testEmail, testPass, 'Dev Auto Tester', tempRole);
                    if (result.error && (result.error.message.includes('already registered') || result.error.status === 400 || (result.error.message || '').includes('rate limit') === false)) {
                        UI.showToast('Test user exists, attempting login...', 'info');
                        result = await Auth.signIn(testEmail, testPass);
                    }
                }
                
                if (result.error) {
                    UI.showToast('Auth error: ' + result.error.message, 'error');
                } else {
                    UI.showToast('DEV: Test account authenticated.', 'success');
                    localStorage.removeItem('edtechra_role');
                    localStorage.removeItem('edtechra_display_name');
                    window.location.hash = 'home';
                    setTimeout(() => window.location.reload(), 500);
                }
                UI.hideLoader();
            });
        }

        form.addEventListener('submit', async (e) => {'''

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced 1")
if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced 2")
if target3 in content:
    content = content.replace(target3, replacement3)
    print("Replaced 3")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
