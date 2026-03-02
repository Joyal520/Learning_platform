# EDTECHRA — Student Creator Hub

A production-ready educational platform for student creativity.

## Setup Instructions

### 1. Supabase Backend
1. Create a new project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** and run the contents of [`supabase_schema.sql`](supabase_schema.sql).
3. Go to **Storage**:
    - Create a bucket named `submissions_private` (set to private).
    - Create a bucket named `approved_public` (set to public).
4. Go to **Project Settings > API**:
    - Copy your `Project URL` and `Anon Key`.
    - Update them in `assets/js/supabase.js`.

### 2. Authentication
1. Go to **Authentication > Providers** and ensure `Email` is enabled.
2. Under **URL Configuration**, set the `Site URL` to your GitHub Pages URL (e.g., `https://username.github.io/repo-name/`).

### 3. Local Development
1. Clone the repository.
2. Open `index.html` using a local server (e.g., VS Code Live Server).

## Deployment (GitHub Pages)
1. Push the code to a GitHub repository.
2. Go to **Settings > Pages**.
3. Select the branch (usually `main`) and folder (`/root`) to deploy.

## Roles
- **Student**: Can upload works and browse approved content.
- **Teacher**: Can review pending submissions and reject them with feedback.
- **Admin**: Full access to moderation (including approval), user roles, and system stats.

> [!NOTE]
> All security is enforced via **Row Level Security (RLS)** in the database. Role switching is only possible via the Admin Dashboard or direct SQL.
