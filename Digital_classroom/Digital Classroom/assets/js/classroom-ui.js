class ClassroomUI {
  static getRouteHref(target, params = {}) {
    const classroomId = params.classroomId || params.id;
    const inRootRuntime = Boolean(window.App);

    if (!inRootRuntime) {
      if (target === "dashboard") return "teacher-dashboard.html";
      if (target === "create") return "create-classroom.html";
      if (target === "detail") return `classroom-detail.html?classroomId=${encodeURIComponent(classroomId || "")}`;
      if (target === "activityHub") return `activity-hub.html?classroomId=${encodeURIComponent(classroomId || "")}`;
      if (target === "resources") return `teacher-resources.html?classroomId=${encodeURIComponent(classroomId || "")}`;
      if (target === "savedCollections") return `saved-collections.html?classroomId=${encodeURIComponent(classroomId || "")}`;
      if (target === "student") return `student-dashboard.html?classroomId=${encodeURIComponent(classroomId || "")}`;
      if (target === "join") return `join-classroom.html?classroomId=${encodeURIComponent(classroomId || "")}`;
    }

    if (target === "dashboard") return "#classroom";
    if (target === "create") return "#classroom/create";
    if (target === "detail") return `#classroom/detail/${encodeURIComponent(classroomId || "")}`;
    if (target === "activityHub") return classroomId ? `#classroom/activity-hub/${encodeURIComponent(classroomId)}` : "#classroom/activity-hub";
    if (target === "resources") return "#classroom/resources";
    if (target === "savedCollections") {
      const classroomParam = classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : "";
      return `#classroom/saved-collections${classroomParam}`;
    }
    if (target === "student") return `#classroom/student/${encodeURIComponent(classroomId || "")}`;
    if (target === "join") return `#classroom/join/${encodeURIComponent(classroomId || "")}`;
    if (target === "myClasses") return "#my-classes";
    return "#classroom";
  }

  static getRootRouteHref(target, params = {}) {
    const classroomId = params.classroomId || params.id || "";
    if (window.App) {
      if (target === "upload") {
        const classroomParam = classroomId ? `&classroomId=${encodeURIComponent(classroomId)}` : "";
        return `#upload?context=classroom&source=digital_classroom${classroomParam}`;
      }
      if (target === "myUploads") {
        const classroomParam = classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : "";
        return `#classroom/resources${classroomParam}`;
      }
      if (target === "savedCollections") {
        const classroomParam = classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : "";
        return `#classroom/saved-collections${classroomParam}`;
      }
      if (target === "explore") return "#explore";
    }

    const rootPath = window.location.pathname.replace(/Digital_classroom\/Digital%20Classroom\/[^/]*$/i, "");
    if (target === "upload") {
      const classroomParam = classroomId ? `&classroomId=${encodeURIComponent(classroomId)}` : "";
      return `${window.location.origin}${rootPath}#upload?context=classroom&source=digital_classroom${classroomParam}`;
    }
    if (target === "myUploads") {
      const classroomParam = classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : "";
      return `${window.location.origin}${rootPath}#classroom/resources${classroomParam}`;
    }
    if (target === "savedCollections") {
      const classroomParam = classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : "";
      return `${window.location.origin}${rootPath}#classroom/saved-collections${classroomParam}`;
    }
    if (target === "explore") return `${window.location.origin}${rootPath}#explore`;
    return "#";
  }

  static escape(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  static getTeacherAssets() {
    const rootImages = "../../assets/images/";
    return {
      classroomHero: `${rootImages}classroom.webp`,
      aiRobot: `${rootImages}ai-robot.webp`,
      tasksEmpty: `${rootImages}tasks-empty.webp`,
      messagesEmpty: `${rootImages}messages-empty.webp`
    };
  }

  static renderTeacherAssetImage(src, alt, className = "") {
    return `
      <div class="teacher-asset-frame ${className}">
        <img src="${this.escape(src)}" alt="${this.escape(alt)}" loading="lazy" decoding="async" onerror="this.closest('.teacher-asset-frame')?.classList.add('is-missing'); this.remove();">
        <div class="teacher-asset-fallback" aria-hidden="true">
          <span>${this.escape(alt)}</span>
        </div>
      </div>
    `;
  }

  static getBrandLogoSrc() {
    return window.App ? "assets/images/logo.webp" : "../../assets/images/logo.webp";
  }

  static setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  static renderSidebar(activePage = "dashboard") {
    const links = activePage === "detail"
      ? [
        ["detail", "#", "Classroom", this.getIcon("classroom")],
        ["overview", "#classroom-title", "Overview", this.getIcon("home")],
        ["students", "#students-container", "Students", this.getIcon("users")],
        ["tasks", "#assignment-form", "Tasks", this.getIcon("assignment")],
        ["quizzes", "#", "Quizzes", this.getIcon("play")],
        ["exams", "#assignment-form", "Exams", this.getIcon("clipboard")],
        ["competitions", "#future-activity-routing", "Competitions", this.getIcon("trophy")],
        ["attendance", "#attendance-container", "Attendance", this.getIcon("attendance")],
        ["reports", "#analytics-container", "Reports", this.getIcon("bars")],
        ["ai-reports", "#ai-feedback-output", "AI Reports", this.getIcon("sparkles")],
        ["settings", "#danger-notice", "Settings", this.getIcon("settings")]
      ]
      : [
      ["dashboard", this.getRouteHref("dashboard"), "Home", this.getIcon("home")],
      ["create", this.getRouteHref("create"), "Create", this.getIcon("plusSquare")],
      ["activity-hub", this.getRouteHref("dashboard"), "Activities", this.getIcon("assignment")],
      ["teacher-resources", this.getRouteHref("resources"), "Resources", this.getIcon("library")],
      ["content", this.getRouteHref("dashboard"), "Content", this.getIcon("library")],
      ["leaderboard", this.getRouteHref("dashboard"), "Leaderboard", this.getIcon("trophy")],
      ["analytics", this.getRouteHref("dashboard"), "Analytics", this.getIcon("bars")],
      ["feedback", this.getRouteHref("dashboard"), "AI Feedback", this.getIcon("sparkles")]
    ];

    return `
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="teacher-dashboard.html" aria-label="Edtechra Digital Classroom">
          <span class="brand-mark">
            <img class="classroom-brand-logo-mark" src="${this.getBrandLogoSrc()}" alt="" aria-hidden="true">
          </span>
          <span class="brand-copy">
            <img class="classroom-brand-logo" src="${this.getBrandLogoSrc()}" alt="EdTechra">
            <small>Classroom</small>
          </span>
        </a>
        <nav class="nav-menu" aria-label="Teacher navigation">
          ${links.map(([key, href, label, icon]) => `
            <a href="${href}" class="nav-link ${activePage === key ? "active" : ""}" aria-label="${label}">
              <span class="nav-icon">${icon}</span>
              <span class="nav-label">${label}</span>
            </a>
          `).join("")}
        </nav>
        <div class="sidebar-footer">
          <a href="#settings" class="nav-link nav-link-ghost" aria-label="Settings">
            <span class="nav-icon">${this.getIcon("settings")}</span>
            <span class="nav-label">Settings</span>
          </a>
          <div class="sidebar-profile glass-chip">
            <span class="avatar avatar-small">TC</span>
            <div>
              <strong>Teacher</strong>
              <span>Control Center</span>
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  static renderMobileNav(activePage = "dashboard") {
    const links = [
      ["dashboard", this.getRouteHref("dashboard"), "Home", this.getIcon("home")],
      ["create", this.getRouteHref("create"), "Create", this.getIcon("plusSquare")],
      ["activity-hub", this.getRouteHref("dashboard"), "Activities", this.getIcon("assignment")],
      ["teacher-resources", this.getRouteHref("resources"), "Resources", this.getIcon("library")],
      ["content", this.getRouteHref("dashboard"), "Content", this.getIcon("library")],
      ["leaderboard", this.getRouteHref("dashboard"), "Ranks", this.getIcon("trophy")],
      ["analytics", this.getRouteHref("dashboard"), "Stats", this.getIcon("bars")]
    ];

    return `
      <nav class="mobile-nav glass-panel" aria-label="Mobile navigation">
        ${links.map(([key, href, label, icon]) => `
          <a href="${href}" class="mobile-nav-link ${activePage === key ? "active" : ""}">
            <span class="nav-icon">${icon}</span>
            <span>${label}</span>
          </a>
        `).join("")}
      </nav>
    `;
  }

  static getIcon(name) {
    const icons = {
      home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>`,
      plusSquare: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`,
      library: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M8 4v16"/></svg>`,
      trophy: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v3a4 4 0 0 1-8 0Z"/><path d="M6 7H4a3 3 0 0 0 3 3"/><path d="M18 7h2a3 3 0 0 1-3 3"/><path d="M12 11v4"/><path d="M9 20h6"/><path d="M10 15h4"/></svg>`,
      bars: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10"/><path d="M12 20V4"/><path d="M19 20v-7"/></svg>`,
      play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>`,
      sparkles: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/><path d="M4 17v4"/><path d="M6 19H2"/></svg>`,
      settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z"/></svg>`,
      classroom: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="3"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`,
      users: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><path d="M9.5 11A4 4 0 1 0 9.5 3A4 4 0 1 0 9.5 11Z"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg>`,
      assignment: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="3"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>`,
      clipboard: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4.5h6v3H9z"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>`,
      attendance: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/><path d="m8 15 2 2 5-5"/></svg>`,
      message: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v5A3.5 3.5 0 0 1 16.5 15H12l-5 4v-4A3 3 0 0 1 4 12Z"/></svg>`,
      send: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-9 9"/><path d="m21 3-6 18-3-9-9-3Z"/></svg>`,
      arrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>`,
      arrowUp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></svg>`,
      arrowDown: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="m18 13-6 6-6-6"/></svg>`,
      dots: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>`,
      search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>`,
      star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/></svg>`,
      warning: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 10 18H2Z"/><path d="M12 9v5"/><path d="M12 18h.01"/></svg>`,
      archive: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="5" rx="2"/><path d="M6 9v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>`,
      trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg>`
    };

    return icons[name] || "";
  }

  static getDashboardIcon(name) {
    const icons = {
      students: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/><path d="M15.5 10.5a3 3 0 1 0 0-6"/><path d="M2.5 21v-1.5a5.5 5.5 0 0 1 11 0V21"/><path d="M14.8 15.2A4.8 4.8 0 0 1 21.5 19.6V21"/></svg>`,
      assignments: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="4"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h3"/><path d="M16 3.5v3H8v-3"/></svg>`,
      submissions: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><rect x="4" y="13" width="16" height="7" rx="3"/><path d="M8 16.5h8"/></svg>`,
      completion: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M7 6H4.5A2.5 2.5 0 0 0 7 10"/><path d="M17 6h2.5A2.5 2.5 0 0 1 17 10"/></svg>`,
      performance: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12 19 5"/><path d="M17 5h2v2"/></svg>`,
      deadlines: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="4"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M4 10h16"/><path d="M9 14h3"/><path d="M9 17h6"/></svg>`,
      contentPreview: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/><circle cx="12" cy="12" r="9"/></svg>`,
      attendance: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20V11"/><path d="M12 20V5"/><path d="M18 20v-8"/><rect x="4" y="11" width="4" height="9" rx="2"/><rect x="10" y="5" width="4" height="15" rx="2"/><rect x="16" y="12" width="4" height="8" rx="2"/></svg>`,
      classroomDefault: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="11" rx="3"/><path d="M8 20h8"/><path d="M12 16v4"/><path d="M8 9h8"/></svg>`,
      classroomEnglish: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5c2.8-1.4 5.2-1.4 8 0v13c-2.8-1.4-5.2-1.4-8 0Z"/><path d="M12 6.5c2.8-1.4 5.2-1.4 8 0v13c-2.8-1.4-5.2-1.4-8 0Z"/><path d="M8 10h1.5"/><path d="M15 10h1.5"/></svg>`,
      classroomMaths: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M8.5 8h7"/><path d="M9 12h.1"/><path d="M12 12h.1"/><path d="M15 12h.1"/><path d="M9 16h.1"/><path d="M12 16h.1"/><path d="M15 16h.1"/></svg>`,
      classroomScience: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4"/><path d="M11 3v5l-5 9a3 3 0 0 0 2.6 4.5h6.8A3 3 0 0 0 18 17l-5-9V3"/><path d="M8.5 16h7"/></svg>`,
      chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`
    };

    return icons[name] || icons.classroomDefault;
  }

  static hydrateDashboardIcons(root = document) {
    root.querySelectorAll("[data-dashboard-icon]").forEach((element) => {
      element.innerHTML = this.getDashboardIcon(element.dataset.dashboardIcon);
    });
    root.querySelectorAll("[data-icon]").forEach((element) => {
      element.innerHTML = this.getIcon(element.dataset.icon);
    });
  }

  static getClassroomVisualType(classroom = {}) {
    const subject = String(classroom.subject || "").toLowerCase();
    if (subject.includes("math")) return "maths";
    if (subject.includes("science") || subject.includes("physics") || subject.includes("chem") || subject.includes("bio")) return "science";
    if (subject.includes("english") || subject.includes("writing") || subject.includes("literature")) return "english";
    return "default";
  }

  static getClassroomLabel(classroom = {}) {
    const subject = String(classroom.subject || "").trim();
    const grade = String(classroom.grade || "").trim();
    if (subject && grade) return `${subject} • ${grade}`;
    if (subject) return subject;
    if (grade) return grade;
    return "Classroom";
  }

  static renderClassroomIllustration(classroom = {}) {
    const visualType = this.getClassroomVisualType(classroom);
    const isMath = visualType === "maths";
    const isScience = visualType === "science";
    const isEnglish = visualType === "english";

    return `
      <svg class="classroom-card-art" viewBox="0 0 360 150" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="card-art-surface-${this.escape(classroom.id || "default")}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="1" stop-color="#edf6ff"/>
          </linearGradient>
        </defs>
        <rect x="14" y="18" width="332" height="112" rx="26" fill="url(#card-art-surface-${this.escape(classroom.id || "default")})" opacity=".92"/>
        <ellipse cx="190" cy="126" rx="128" ry="12" fill="#b9c8e8" opacity=".22"/>
        <rect x="72" y="78" width="108" height="28" rx="10" fill="#f2c990"/>
        <path d="M88 106v22M164 106v22" stroke="#b4875f" stroke-width="7" stroke-linecap="round"/>
        <rect x="96" y="50" width="46" height="38" rx="14" fill="#7b61ff"/>
        <path d="M214 74c-18-32 1-60 28-58 20 2 26 25 9 43 21-12 45-4 45 18 0 25-38 31-82-3z" fill="#87c977"/>
        <rect x="231" y="72" width="28" height="44" rx="9" fill="#e7c49a"/>
        ${isMath ? `
          <rect x="206" y="56" width="52" height="68" rx="10" fill="#55a8ff"/>
          <circle cx="219" cy="74" r="5" fill="#e9f7ff"/><circle cx="237" cy="74" r="5" fill="#e9f7ff"/>
          <path d="M216 92h32M216 108h22" stroke="#e9f7ff" stroke-width="6" stroke-linecap="round"/>
          <path d="M274 74h34M291 57v34" stroke="#ff9b42" stroke-width="9" stroke-linecap="round"/>
        ` : ""}
        ${isScience ? `
          <path d="M236 44h28v18l26 50c5 10-2 20-13 20h-54c-11 0-18-10-13-20l26-50z" fill="#bda4ff" opacity=".9"/>
          <path d="M226 108h48" stroke="#6b7ff7" stroke-width="8" stroke-linecap="round"/>
          <rect x="272" y="42" width="28" height="76" rx="8" transform="rotate(22 286 80)" fill="#4f8cff"/>
        ` : ""}
        ${isEnglish ? `
          <path d="M210 88c24-18 56-18 82 0v44c-26-16-58-16-82 0z" fill="#fff8e8" stroke="#f3b55f" stroke-width="5"/>
          <path d="M251 88v43M224 104h18M262 104h18" stroke="#f3b55f" stroke-width="4" stroke-linecap="round"/>
          <rect x="292" y="78" width="12" height="48" rx="6" fill="#7b61ff"/>
          <rect x="310" y="72" width="12" height="54" rx="6" fill="#ff9b42"/>
        ` : ""}
        ${!isMath && !isScience && !isEnglish ? `
          <rect x="212" y="46" width="86" height="54" rx="12" fill="#53b39f"/>
          <path d="M228 70h54M228 86h36" stroke="#dffcf5" stroke-width="6" stroke-linecap="round"/>
        ` : ""}
      </svg>
    `;
  }

  static mountShell(activePage) {
    const shell = document.getElementById("app-shell");
    if (!shell) return;

    shell.insertAdjacentHTML("afterbegin", this.renderSidebar(activePage));
    shell.insertAdjacentHTML("beforeend", this.renderMobileNav(activePage));

    document.querySelectorAll(".mobile-topbar").forEach((topbar) => {
      if (topbar.querySelector(".mobile-topbar-logo")) return;
      topbar.insertAdjacentHTML(
        "afterbegin",
        `<img class="mobile-topbar-logo" src="${this.getBrandLogoSrc()}" alt="EdTechra">`
      );
    });

    const toggle = document.querySelector("[data-sidebar-toggle]");
    const sidebar = document.getElementById("sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    }
  }

  static emptyState(title, message) {
    return `
      <div class="empty-state">
        <strong>${this.escape(title)}</strong>
        <span>${this.escape(message)}</span>
      </div>
    `;
  }

  static renderTeacherLoginRequired() {
    this.hydrateDashboardIcons();
    const container = document.getElementById("classrooms-container");
    const activityContainer = document.getElementById("upcoming-activities");
    const contentContainer = document.getElementById("content-preview");

    this.setText("stat-total-classrooms", 0);
    this.setText("stat-total-students", 0);
    this.setText("stat-total-assignments", 0);
    this.setText("stat-total-submissions", 0);
    this.setText("dashboard-completion", "0%");
    this.setText("stat-average-completion", "0%");
    this.setText("dashboard-average", 0);
    this.setText("stat-trend-classrooms", "Sign in to sync");
    this.setText("stat-trend-students", "Session required");
    this.setText("stat-trend-assignments", "Session required");
    this.setText("stat-trend-submissions", "Session required");

    if (container) {
      container.innerHTML = `
        <div class="empty-state auth-state-card">
          <strong>Sign in to view your classrooms</strong>
          <span>Your Supabase connection is ready, but this standalone dashboard does not have an active Edtechra teacher session yet.</span>
          <div class="auth-state-actions">
            <button class="btn btn-primary" type="button" id="teacher-signin-btn">Sign in as Teacher</button>
            <button class="btn btn-secondary" type="button" id="teacher-demo-btn">Use Demo Mode</button>
          </div>
        </div>
      `;
    }

    if (activityContainer) {
      activityContainer.innerHTML = this.emptyState("No session yet", "Upcoming work will load after sign-in or when Demo Mode is selected.");
    }

    if (contentContainer) {
      contentContainer.innerHTML = this.emptyState("Content paused", "Sign in to continue with real classroom data.");
    }

    document.getElementById("teacher-signin-btn")?.addEventListener("click", () => {
      ClassroomAPI.storeReturnUrl(window.location.href);
      window.location.href = ClassroomAPI.getLoginUrl(window.location.href);
    });

    document.getElementById("teacher-demo-btn")?.addEventListener("click", async () => {
      ClassroomAPI.useDemoMode();
      await this.renderTeacherDashboard();
    });
  }

  static async renderTeacherDashboard() {
    this.hydrateDashboardIcons();
    let dashboardData;
    try {
      dashboardData = await ClassroomAPI.getTeacherDashboardData();
    } catch (error) {
      this.renderTeacherDashboardError(error);
      return;
    }

    const {
      source,
      classrooms,
      enrichedClassrooms,
      contentItems,
      leaderboardRows,
      assignmentRows,
      stats,
      teacherProfile
    } = dashboardData;
    const container = document.getElementById("classrooms-container");
    const activityContainer = document.getElementById("upcoming-activities");
    const contentContainer = document.getElementById("content-preview");
    const welcomeName = teacherProfile?.display_name || teacherProfile?.displayName || teacherProfile?.email || "Teacher";
    this.setText("teacher-welcome-name", welcomeName.split("@")[0]);

    if (container) {
      container.innerHTML = enrichedClassrooms.length
        ? enrichedClassrooms.map((classroom) => `
          <article class="classroom-card glass-card">
            <div class="classroom-banner ${this.escape(classroom.theme || "theme-blue")}">
              <span class="classroom-banner-badge">${this.escape(this.getClassroomLabel(classroom))}</span>
              <button class="card-icon-button" type="button" tabindex="-1" aria-hidden="true">${this.getIcon("dots")}</button>
              ${this.renderClassroomIllustration(classroom)}
            </div>
            <div class="classroom-card-body">
              <p class="card-kicker">${this.escape(classroom.subject)}  •  ${this.escape(classroom.grade)}</p>
              <h3>${this.escape(classroom.name)}</h3>
              <div class="classroom-meta">
                <span><span class="meta-icon">${this.getIcon("users")}</span>${classroom.studentCount || 0} students</span>
                <span><span class="meta-icon">${this.getIcon("assignment")}</span>${classroom.assignmentCount || 0} tasks</span>
              </div>
              <div class="classroom-invite-mini" aria-label="Student invitation">
                <span>Code <strong>${this.escape(classroom.inviteCode || "Pending")}</strong></span>
                <button class="copy-invite-mini" type="button" data-copy-invite="${this.escape(classroom.inviteCode || "")}" ${classroom.inviteCode ? "" : "disabled"}>Copy Link</button>
              </div>
              <div class="classroom-action-row">
                <a class="inline-action" href="${this.getRouteHref("detail", { classroomId: classroom.id })}">Open ${this.getIcon("arrow")}</a>
                <a class="inline-action inline-action-muted" href="${this.getRouteHref("detail", { classroomId: classroom.id })}#invite-link-input">Invite Students</a>
              </div>
            </div>
          </article>
        `).join("")
        : `
          <div class="empty-state classroom-empty-state">
            <span class="empty-state-visual" data-dashboard-icon="classroomDefault" aria-hidden="true"></span>
            <strong>No classrooms yet</strong>
            <span>Create your first classroom to begin organising students, tasks, and learning progress.</span>
            <a class="btn btn-primary btn-small" href="${this.getRouteHref("create")}">+ Create Classroom</a>
          </div>
        `;
      this.hydrateDashboardIcons(container);
      this.bindClassroomInviteActions(container);
    }

    if (activityContainer) {
      const upcoming = assignmentRows
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5);
      activityContainer.innerHTML = upcoming.length
        ? upcoming.map((assignment) => `
          <div class="list-item list-item-feature">
            <div class="list-item-icon soft-gradient-amber">${this.getIcon("assignment")}</div>
            <div class="list-item-content">
              <h4>${this.escape(assignment.title)}</h4>
              <span>${this.escape(assignment.classroomName)} / Due ${this.escape(assignment.dueDate)}</span>
            </div>
            <strong class="list-item-value">${assignment.points} pts</strong>
          </div>
        `).join("")
        : this.emptyState("No upcoming work", "Assignments created in a classroom will appear here.");
    }

    if (contentContainer) {
      const previewItems = contentItems.slice(0, 4);
      contentContainer.innerHTML = previewItems.length
        ? previewItems.map((item) => `
          <div class="list-item compact list-item-feature">
            <div class="list-item-icon soft-gradient-blue">${this.getIcon("library")}</div>
            <div class="list-item-content">
              <h4>${this.escape(item.title)}</h4>
              <span>${this.escape(item.type)} / ${this.escape(item.subject)} / ${item.minutes} min</span>
            </div>
          </div>
        `).join("")
        : this.emptyState("No content items yet", source === "supabase"
          ? "Assigned classroom resources will appear here when available."
          : "Demo Edtechra resources will appear here when available.");
    }

    const totalStudents = stats.studentCount;
    const totalAssignments = stats.assignmentCount;
    const totalSubmissions = stats.submissionCount;
    const averageCompletion = totalStudents && totalAssignments
      ? Math.round((totalSubmissions / (totalStudents * totalAssignments)) * 100)
      : 0;

    this.setText("stat-total-classrooms", stats.classroomCount);
    this.setText("stat-total-students", totalStudents);
    this.setText("stat-total-assignments", totalAssignments);
    this.setText("stat-total-submissions", totalSubmissions);
    this.setText("dashboard-completion", `${averageCompletion}%`);
    this.setText("stat-average-completion", `${averageCompletion}%`);
    this.setText("dashboard-average", totalStudents ? Math.round(leaderboardRows.reduce((sum, row) => sum + row.points, 0) / totalStudents) : 0);
    this.setText("stat-trend-classrooms", stats.classroomCount ? `+${stats.classroomCount} active` : "Start with one");
    this.setText("stat-trend-students", totalStudents ? `+${totalStudents} enrolled` : "Waiting for joins");
    this.setText("stat-trend-assignments", totalAssignments ? `${totalAssignments} live tasks` : "No tasks yet");
    this.setText("stat-trend-submissions", totalSubmissions ? `${totalSubmissions} received` : "No submissions");
  }

  static bindClassroomInviteActions(container = document) {
    container.querySelectorAll("[data-copy-invite]").forEach((button) => {
      button.addEventListener("click", async () => {
        const inviteCode = button.dataset.copyInvite;
        if (!inviteCode) return;

        const inviteLink = this.getInviteLink(inviteCode);
        await navigator.clipboard.writeText(inviteLink);
        button.textContent = "Copied";
        this.showToast("Invite link copied.", "success");
        window.setTimeout(() => {
          button.textContent = "Copy Link";
        }, 1600);
      });
    });
  }

  static renderTeacherDashboardError(error) {
    this.hydrateDashboardIcons();
    const container = document.getElementById("classrooms-container");
    const activityContainer = document.getElementById("upcoming-activities");
    const contentContainer = document.getElementById("content-preview");

    this.setText("stat-total-classrooms", 0);
    this.setText("stat-total-students", 0);
    this.setText("stat-total-assignments", 0);
    this.setText("stat-total-submissions", 0);
    this.setText("dashboard-completion", "0%");
    this.setText("stat-average-completion", "0%");
    this.setText("dashboard-average", 0);
    this.setText("stat-trend-classrooms", "Supabase issue");
    this.setText("stat-trend-students", "Supabase issue");
    this.setText("stat-trend-assignments", "Supabase issue");
    this.setText("stat-trend-submissions", "Supabase issue");

    const message = error?.code === "DIGITAL_CLASSROOM_SCHEMA_MISSING"
      ? "Digital Classroom Supabase tables are missing or unavailable. Apply the classroom migration before using live teacher data."
      : "Supabase could not return teacher classroom data. Check RLS policies and the browser console.";

    console.warn("[Digital Classroom] Teacher dashboard could not load real Supabase data.", error);

    if (container) {
      container.innerHTML = this.emptyState("Real classroom data unavailable", message);
    }
    if (activityContainer) {
      activityContainer.innerHTML = this.emptyState("No upcoming work", "Live assignments could not be loaded.");
    }
    if (contentContainer) {
      contentContainer.innerHTML = this.emptyState("No content items", "Live classroom resources could not be loaded.");
    }
  }

  static async renderCreateClassroom() {
    const form = document.getElementById("create-classroom-form");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const required = ["name", "subject", "grade"];
      const missing = required.some((field) => !String(formData.get(field) || "").trim());

      if (missing) {
        this.showNotice("create-notice", "Please complete classroom name, subject, and grade.", "error");
        return;
      }

      const classroom = await ClassroomAPI.createClassroom({
        name: formData.get("name"),
        subject: formData.get("subject"),
        grade: formData.get("grade"),
        description: formData.get("description") || "",
        theme: formData.get("theme")
      });

      window.location.href = this.getRouteHref("detail", { classroomId: classroom.id });
    });
  }

  static async renderClassroomDetail(classroomId) {
    const detectedClassroomId = this.getCurrentClassroomId(classroomId);
    console.log("[Digital Classroom] detected classId", detectedClassroomId);
    this.bindLiveQuizLaunch(detectedClassroomId);

    const classroom = await ClassroomAPI.getClassroomById(detectedClassroomId);
    if (!classroom) {
      const main = document.querySelector("main");
      if (main) main.innerHTML = this.emptyState("Classroom not found", "Return to the dashboard and choose an existing classroom.");
      return;
    }

    const assets = this.getTeacherAssets();
    const teacherName = classroom.teacherName || classroom.teacher?.display_name || "Class Teacher";
    const main = document.querySelector("main");
    if (main) main.dataset.classroomId = detectedClassroomId;
    this.setText("classroom-title", classroom.name);
    this.setText("mobile-classroom-title", classroom.name);
    this.setText("classroom-subtitle", `${classroom.subject} / ${classroom.grade}`);
    this.setText("classroom-description", classroom.description || "No description provided.");
    this.setText("hero-subject", classroom.subject || "Subject");
    this.setText("hero-grade", classroom.grade || "Grade");
    this.setText("teacher-name", teacherName);
    this.setText("teacher-avatar", teacherName.charAt(0).toUpperCase());
    this.setText("delete-classroom-name", classroom.name);

    const heroAsset = document.getElementById("classroom-hero-asset");
    if (heroAsset) {
      heroAsset.innerHTML = this.renderTeacherAssetImage(assets.classroomHero, "Classroom illustration", "teacher-hero-image");
    }

    const aiAsset = document.getElementById("ai-report-asset");
    if (aiAsset) {
      aiAsset.innerHTML = this.renderTeacherAssetImage(assets.aiRobot, "AI classroom report robot", "teacher-ai-robot-image");
    }

    const inviteLink = this.getInviteLink(classroom.inviteCode || detectedClassroomId);
    const inviteInput = document.getElementById("invite-link-input");
    if (inviteInput) inviteInput.value = inviteLink;
    this.setText("classroom-invite-code", classroom.inviteCode || "Pending");

    document.querySelectorAll(".wa-share-link").forEach((waShareBtn) => {
      waShareBtn.href = `https://wa.me/?text=${encodeURIComponent(`Join my Edtechra Digital Classroom "${classroom.name}" here: ${inviteLink}`)}`;
    });

    document.getElementById("copy-invite-btn")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(inviteLink);
      this.showNotice("invite-notice", "Invite link copied.", "success");
    });

    const activityHubCard = document.querySelector("[data-activity-hub-link]");
    if (activityHubCard) {
      activityHubCard.href = this.getRouteHref("activityHub", { classroomId: detectedClassroomId });
    }

    this.hydrateDashboardIcons(document);
    this.bindAssignmentForm(detectedClassroomId);
    this.enhanceDateInputs();
    this.bindMessagePanel(detectedClassroomId);
    this.bindDangerZone(detectedClassroomId, classroom.name);
    await this.refreshClassroomSections(detectedClassroomId);
  }

  static async renderActivityHub(classroomId) {
    const detectedClassroomId = this.getCurrentClassroomId(classroomId);
    const backHref = detectedClassroomId
      ? this.getRouteHref("detail", { classroomId: detectedClassroomId })
      : this.getRouteHref("dashboard");

    document.querySelectorAll("[data-activity-back]").forEach((link) => {
      link.setAttribute("href", backHref);
    });

    document.querySelector('[data-hub-action="resources"]')?.setAttribute("href", this.getRootRouteHref("myUploads", { classroomId: detectedClassroomId }));
    document.querySelector('[data-hub-action="collections"]')?.setAttribute("href", this.getRootRouteHref("savedCollections", { classroomId: detectedClassroomId }));
    document.querySelector('[data-hub-action="upload"]')?.setAttribute("href", this.getRootRouteHref("upload", { classroomId: detectedClassroomId }));

    const placeholder = document.getElementById("premium-library-placeholder");
    document.querySelector('[data-hub-action="premium"]')?.addEventListener("click", () => {
      if (!placeholder) return;
      placeholder.hidden = false;
      placeholder.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    const modal = document.getElementById("activity-guide-modal");
    const guideSeenKey = "edtechra_activity_hub_guide_seen";
    const openModal = () => {
      if (!modal) return;
      modal.hidden = false;
      document.body.classList.add("activity-modal-open");
    };
    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
      document.body.classList.remove("activity-modal-open");
    };
    const acknowledgeGuide = () => {
      localStorage.setItem(guideSeenKey, "true");
      closeModal();
    };

    document.getElementById("activity-guide-btn")?.addEventListener("click", openModal);
    document.getElementById("activity-guide-close")?.addEventListener("click", closeModal);
    document.getElementById("activity-guide-ok")?.addEventListener("click", acknowledgeGuide);
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });

    if (localStorage.getItem(guideSeenKey) !== "true") {
      window.setTimeout(openModal, 350);
    }

    window.ClassroomSpreeActions = {
      createSpreeFromResources: (resources = []) => this.createSpreeFromResources(resources, detectedClassroomId),
      assignSpreeToClassroom: (spree = {}) => this.assignSpreeToClassroom(spree, detectedClassroomId),
      trackSpreeProgress: (spreeId) => this.trackSpreeProgress(spreeId, detectedClassroomId)
    };
  }

  static async renderTeachingResources(classroomId = "") {
    const detectedClassroomId = this.getCurrentClassroomId(classroomId);
    const resourcesList = document.getElementById("teaching-resources-list");
    const uploadLink = document.querySelector("[data-resource-upload-link]");
    if (uploadLink) uploadLink.setAttribute("href", this.getRootRouteHref("upload", { classroomId: this.getCurrentClassroomId() }));

    const backLink = document.querySelector("[data-resources-back]");
    if (backLink) backLink.setAttribute("href", this.getRouteHref("dashboard"));

    const [resources, dashboardData] = await Promise.all([
      ClassroomAPI.getTeachingResources(detectedClassroomId),
      ClassroomAPI.getTeacherDashboardData()
    ]);
    const classrooms = dashboardData.classrooms || [];

    if (resourcesList) {
      resourcesList.innerHTML = resources.length
        ? resources.map((resource) => this.renderTeachingResourceCard(resource)).join("")
        : this.emptyState("No teaching resources yet", "Upload a resource from your teacher account and it will appear here.");
    }

    this.bindTeachingResourceActions(resources, classrooms);
    this.enhanceDateInputs();

    const params = new URLSearchParams((window.location.hash.split("?")[1] || window.location.search || "").replace(/^#/, ""));
    const assignResourceId = params.get("assignResource");
    if (assignResourceId) {
      const resource = resources.find((item) => String(item.id) === String(assignResourceId));
      if (resource) this.openResourceAssignment(resource, classrooms);
    }
  }

  static renderTeachingResourceCard(resource) {
    const visibilityText = resource.visibility === "public" ? "Public" : "Private";
    const previewUrl = resource.fileUrl || `#detail/${encodeURIComponent(resource.id)}`;
    const previewTarget = resource.fileUrl ? "_blank" : "_self";
    const previewRel = resource.fileUrl ? "noopener noreferrer" : "";

    return `
      <article class="teaching-resource-card" data-resource-id="${this.escape(resource.id)}">
        <div class="teaching-resource-copy">
          <div class="teaching-resource-title-row">
            <h3>${this.escape(resource.title)}</h3>
            <span class="resource-visibility-badge ${resource.visibility === "public" ? "is-public" : "is-private"}">${visibilityText}</span>
          </div>
          <div class="teaching-resource-meta">
            <span>${this.escape(resource.resourceType)}</span>
            <span>Uploaded ${this.formatDate(resource.createdAt)}</span>
          </div>
          ${resource.description ? `<p>${this.escape(resource.description)}</p>` : ""}
        </div>
        <div class="teaching-resource-actions">
          <a class="btn btn-secondary btn-small" href="${this.escape(previewUrl)}" target="${previewTarget}" rel="${previewRel}">Preview</a>
          <button class="btn btn-primary btn-small" type="button" data-assign-resource="${this.escape(resource.id)}">Assign</button>
          <a class="btn btn-secondary btn-small" href="#edit/${this.escape(resource.id)}">Edit</a>
        </div>
      </article>
    `;
  }

  static async renderSavedCollections() {
    const savedList = document.getElementById("saved-collections-list");
    const detectedClassroomId = this.getCurrentClassroomId();
    const backHref = this.getRouteHref("activityHub", { classroomId: detectedClassroomId });
    document.querySelectorAll("[data-saved-collections-back]").forEach((link) => {
      link.setAttribute("href", backHref);
    });

    try {
      const [savedCollections, dashboardData] = await Promise.all([
        ClassroomAPI.getSavedCollections(),
        ClassroomAPI.getTeacherDashboardData()
      ]);
      const classrooms = dashboardData.classrooms || [];

      if (savedList) {
        savedList.innerHTML = savedCollections.length
          ? savedCollections.map((resource) => this.renderSavedCollectionCard(resource)).join("")
          : this.emptyState("No saved collections yet.", "Save works from Explore to use them in your classroom.");
      }

      this.bindTeachingResourceActions(savedCollections, classrooms);
      this.bindSavedCollectionBulkActions(savedCollections, classrooms);
      this.bindLearningSpreeForm(savedCollections, classrooms, detectedClassroomId);
      this.enhanceDateInputs();
    } catch (error) {
      const message = error?.message || String(error);
      console.error(`[Digital Classroom] renderSavedCollections failed while querying bookmarks/submissions: ${message}`, {
        functionName: "renderSavedCollections",
        tables: ["bookmarks", "submissions"],
        code: error?.code || null,
        details: error?.details || null,
        hint: error?.hint || null
      });

      if (savedList) {
        savedList.innerHTML = this.emptyState(
          "Could not load saved collections",
          "Refresh the page or try again after saving a work from Explore."
        );
      }
    }
  }

  static renderSavedCollectionCard(resource) {
    const previewUrl = resource.fileUrl || `#detail/${encodeURIComponent(resource.id)}`;
    const previewTarget = resource.fileUrl ? "_blank" : "_self";
    const previewRel = resource.fileUrl ? "noopener noreferrer" : "";

    return `
      <article class="teaching-resource-card saved-collection-card" data-resource-id="${this.escape(resource.id)}">
        <label class="saved-selection-control" aria-label="Select ${this.escape(resource.title)}">
          <input type="checkbox" data-select-saved-resource="${this.escape(resource.id)}">
          <span aria-hidden="true"></span>
        </label>
        <div class="teaching-resource-copy">
          <div class="teaching-resource-title-row">
            <h3>${this.escape(resource.title)}</h3>
            <span class="resource-visibility-badge is-public">Saved</span>
          </div>
          <div class="teaching-resource-meta">
            <span>${this.escape(resource.resourceType)}</span>
            <span>Saved ${this.formatDate(resource.savedAt)}</span>
            <span>By ${this.escape(resource.authorName)}</span>
          </div>
          ${resource.description ? `<p>${this.escape(resource.description)}</p>` : ""}
        </div>
        <div class="teaching-resource-actions">
          <a class="btn btn-secondary btn-small" href="${this.escape(previewUrl)}" target="${previewTarget}" rel="${previewRel}">Preview</a>
          <button class="btn btn-primary btn-small" type="button" data-assign-resource="${this.escape(resource.id)}">Assign</button>
        </div>
      </article>
    `;
  }

  static bindSavedCollectionBulkActions(resources, classrooms) {
    const selectButton = document.querySelector("[data-select-multiple]");
    const actionBar = document.querySelector("[data-saved-selection-bar]");
    const selectedCount = document.querySelector("[data-selected-count]");
    const assignSelectedButton = document.querySelector("[data-assign-selected]");
    const createSpreeButton = document.querySelector("[data-create-learning-spree]");
    const clearButton = document.querySelector("[data-clear-selection]");
    const list = document.getElementById("saved-collections-list");
    if (!selectButton || !actionBar || !selectedCount || !list) return;

    const selectedIds = new Set();
    const setSelectionMode = (enabled) => {
      list.classList.toggle("is-selecting", enabled);
      selectButton.classList.toggle("active", enabled);
      selectButton.textContent = enabled ? "Selection Mode" : "Select Multiple";
      selectButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    };

    const updateSelectionUi = () => {
      document.querySelectorAll("[data-select-saved-resource]").forEach((checkbox) => {
        const isSelected = selectedIds.has(String(checkbox.dataset.selectSavedResource));
        checkbox.checked = isSelected;
        checkbox.closest(".saved-collection-card")?.classList.toggle("is-selected", isSelected);
      });

      const count = selectedIds.size;
      selectedCount.textContent = `${count} ${count === 1 ? "material" : "materials"} selected`;
      actionBar.hidden = count === 0;
    };

    const clearSelection = () => {
      selectedIds.clear();
      updateSelectionUi();
    };

    setSelectionMode(false);
    updateSelectionUi();

    selectButton.addEventListener("click", () => {
      const enabled = !list.classList.contains("is-selecting");
      setSelectionMode(enabled);
      if (!enabled) clearSelection();
    });

    list.querySelectorAll("[data-select-saved-resource]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const resourceId = String(checkbox.dataset.selectSavedResource || "");
        if (!resourceId) return;
        if (checkbox.checked) selectedIds.add(resourceId);
        else selectedIds.delete(resourceId);
        updateSelectionUi();
      });
    });

    clearButton?.addEventListener("click", clearSelection);
    assignSelectedButton?.addEventListener("click", () => {
      const selectedResources = [...selectedIds]
        .map((id) => resources.find((resource) => String(resource.id) === id))
        .filter(Boolean);
      if (selectedResources.length) this.openResourceAssignment(selectedResources, classrooms);
    });

    createSpreeButton?.addEventListener("click", () => {
      const selectedResources = [...selectedIds]
        .map((id) => resources.find((resource) => String(resource.id) === id))
        .filter(Boolean);
      this.openLearningSpreeForm(selectedResources, classrooms);
    });
  }

  static enhanceDateInputs(root = document) {
    const today = this.getTodayInTimezone();
    root.querySelectorAll("[data-modern-date]").forEach((input) => {
      if (!input.min) input.min = today;
      const shell = input.closest(".date-picker-shell");
      const preview = shell?.querySelector("[data-date-preview]");
      const updatePreview = () => {
        preview.textContent = input.value ? this.formatDate(input.value) : (preview.dataset.placeholder || preview.textContent || "Select date");
        shell?.classList.toggle("has-value", Boolean(input.value));
      };
      if (preview && !preview.dataset.placeholder) preview.dataset.placeholder = preview.textContent || "Select date";
      if (input.dataset.dateBound !== "true") {
        input.dataset.dateBound = "true";
        input.addEventListener("change", updatePreview);
        input.addEventListener("input", updatePreview);
        shell?.addEventListener("click", () => input.showPicker?.());
      }
      updatePreview();
    });
  }

  static getClassroomTimezone() {
    return "Asia/Colombo";
  }

  static addDaysToDate(dateText, days) {
    const [year, month, day] = String(dateText).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
  }

  static getTodayInTimezone(timezone = this.getClassroomTimezone()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  static getSpreeItemUnlockDate(assignment, item) {
    if (assignment.unlockMode !== "one_lesson_per_day") return "";
    const startDate = assignment.startDate || assignment.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    return this.addDaysToDate(startDate, Math.max(Number(item.position || 1) - 1, 0));
  }

  static isSpreeItemUnlocked(assignment, item, today = this.getTodayInTimezone(assignment.timezone || this.getClassroomTimezone())) {
    if (assignment.unlockMode !== "one_lesson_per_day") return true;
    return this.getSpreeItemUnlockDate(assignment, item) <= today;
  }

  static getUnlockText(unlockDate) {
    if (!unlockDate) return "Available";
    const tomorrow = this.addDaysToDate(this.getTodayInTimezone(), 1);
    if (unlockDate === tomorrow) return "Unlocks tomorrow";
    return `Unlocks on ${this.formatDate(unlockDate)}`;
  }

  static getLearningSpreeResources(form) {
    try {
      return JSON.parse(form?.dataset.resources || "[]");
    } catch (error) {
      return [];
    }
  }

  static setLearningSpreeResources(form, resources) {
    if (!form) return;
    form.dataset.resources = JSON.stringify(resources);
    form.elements.resourceIds.value = resources.map((item) => item.id).join(",");
    this.renderLearningSpreeSelectedList(resources);
    this.setText("learning-spree-count", `${resources.length} ${resources.length === 1 ? "selected" : "selected"}`);
  }

  static renderLearningSpreeSelectedList(resources = []) {
    const list = document.getElementById("learning-spree-selected-list");
    if (!list) return;
    list.innerHTML = resources.length
      ? resources.map((resource, index) => `
        <article class="spree-lesson-item" data-spree-resource-id="${this.escape(resource.id)}">
          <span class="spree-lesson-order">${index + 1}</span>
          <div class="spree-lesson-copy">
            <h4>${this.escape(resource.title)}</h4>
            <span>${this.escape(resource.resourceType || "saved work")} / ${resource.savedAt ? `Saved ${this.formatDate(resource.savedAt)}` : this.escape(resource.authorName || "Saved material")}</span>
          </div>
          <div class="spree-lesson-controls">
            <button class="icon-button glass-chip" type="button" data-spree-move="up" data-spree-index="${index}" aria-label="Move ${this.escape(resource.title)} up" ${index === 0 ? "disabled" : ""}>${this.getIcon("arrowUp")}</button>
            <button class="icon-button glass-chip" type="button" data-spree-move="down" data-spree-index="${index}" aria-label="Move ${this.escape(resource.title)} down" ${index === resources.length - 1 ? "disabled" : ""}>${this.getIcon("arrowDown")}</button>
            <button class="icon-button glass-chip" type="button" data-spree-remove="${index}" aria-label="Remove ${this.escape(resource.title)}">${this.getIcon("trash")}</button>
          </div>
        </article>
      `).join("")
      : this.emptyState("No lessons selected", "Return to Saved Collections and choose at least two materials.");
  }

  static openLearningSpreeForm(resources, classrooms = []) {
    const panel = document.getElementById("learning-spree-panel");
    const form = document.getElementById("learning-spree-form");
    if (!panel || !form) return;

    if (resources.length < 2) {
      this.showNotice("learning-spree-notice", "Select at least two saved materials to create a Learning Spree.", "error");
      return;
    }

    panel.hidden = false;
    const classroomSelect = form.querySelector('select[name="classroomId"]');
    const detectedClassroomId = this.getCurrentClassroomId();
    if (classroomSelect) {
      classroomSelect.innerHTML = classrooms.length
        ? classrooms.map((classroom) => `<option value="${this.escape(classroom.id)}">${this.escape(classroom.name)}</option>`).join("")
        : '<option value="" disabled selected>No classrooms available</option>';
      if (detectedClassroomId && classrooms.some((classroom) => String(classroom.id) === String(detectedClassroomId))) {
        classroomSelect.value = detectedClassroomId;
      }
    }

    form.elements.title.value = "Learning Spree";
    form.elements.instructions.value = resources.map((item, index) => `${index + 1}. ${item.title}`).join("\n");
    form.elements.dueDate.value = "";
    form.elements.startDate.value = this.getTodayInTimezone();
    form.querySelector('input[name="unlockMode"][value="open_access"]').checked = true;
    form.querySelector("[data-start-date-group]").hidden = true;
    this.setLearningSpreeResources(form, resources);
    this.enhanceDateInputs(form);
    this.showNotice("learning-spree-notice", "", "");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  static bindLearningSpreeForm(resources, classrooms, classroomId = "") {
    const form = document.getElementById("learning-spree-form");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.querySelectorAll('input[name="unlockMode"]').forEach((input) => {
      input.addEventListener("change", () => {
        const startDateGroup = form.querySelector("[data-start-date-group]");
        const isDaily = form.elements.unlockMode.value === "one_lesson_per_day";
        if (startDateGroup) startDateGroup.hidden = !isDaily;
        form.elements.startDate.required = isDaily;
      });
    });

    document.getElementById("learning-spree-selected-list")?.addEventListener("click", (event) => {
      const moveButton = event.target.closest("[data-spree-move]");
      const removeButton = event.target.closest("[data-spree-remove]");
      const current = this.getLearningSpreeResources(form);
      if (moveButton) {
        const index = Number(moveButton.dataset.spreeIndex);
        const direction = moveButton.dataset.spreeMove === "up" ? -1 : 1;
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= current.length) return;
        [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
        this.setLearningSpreeResources(form, current);
      }
      if (removeButton) {
        const index = Number(removeButton.dataset.spreeRemove);
        current.splice(index, 1);
        this.setLearningSpreeResources(form, current);
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const selectedResources = this.getLearningSpreeResources(form);
      const selectedIds = selectedResources.map((item) => String(item.id || "").trim()).filter(Boolean);
      const classroomValue = String(formData.get("classroomId") || classroomId || "").trim();
      const title = String(formData.get("title") || "").trim();
      const instructions = String(formData.get("instructions") || "").trim();
      const dueDate = String(formData.get("dueDate") || "").trim();
      const unlockMode = String(formData.get("unlockMode") || "open_access").trim();
      const startDate = String(formData.get("startDate") || "").trim();
      const timezone = this.getClassroomTimezone();

      if (!classroomValue || !title || selectedResources.length < 2 || !dueDate || !unlockMode || selectedIds.length !== selectedResources.length) {
        this.showNotice("learning-spree-notice", "Choose a classroom, title, deadline, unlock mode, and at least two valid saved materials.", "error");
        return;
      }

      if (unlockMode === "one_lesson_per_day" && !startDate) {
        this.showNotice("learning-spree-notice", "Choose a start date for One Lesson Per Day.", "error");
        return;
      }

      if (unlockMode === "one_lesson_per_day") {
        const finalUnlockDate = this.addDaysToDate(startDate, selectedResources.length - 1);
        if (startDate > dueDate) {
          this.showNotice("learning-spree-notice", "Start date should not be after the deadline.", "error");
          return;
        }
        if (finalUnlockDate > dueDate) {
          this.showNotice("learning-spree-notice", "The deadline is before all lessons can unlock.", "error");
          return;
        }
      }

      if (unlockMode !== "open_access" && unlockMode !== "one_lesson_per_day") {
        this.showNotice("learning-spree-notice", "Choose a valid unlock mode.", "error");
        return;
      }

      const resourceItems = selectedResources.map((resource, index) => ({
        id: `${resource.id}:${index + 1}`,
        resourceId: resource.id,
        title: resource.title,
        resourceType: resource.resourceType || "saved work",
        savedAt: resource.savedAt || "",
        authorName: resource.authorName || "",
        fileUrl: resource.fileUrl || "",
        position: index + 1
      }));

      const assignment = await ClassroomAPI.createAssignment({
        classroomId: classroomValue,
        title,
        instructions,
        dueDate,
        points: 0,
        assignmentType: "learning_spree",
        resourceItems,
        unlockMode,
        startDate: unlockMode === "one_lesson_per_day" ? startDate : "",
        timezone,
        status: "published"
      });

      this.showNotice("learning-spree-notice", "Learning Spree created successfully.", "success");
      document.querySelector(".spree-success-actions")?.remove();
      const notice = document.getElementById("learning-spree-notice");
      if (notice) {
        notice.insertAdjacentHTML(
          "afterend",
          `<div class="spree-success-actions">
            <a class="btn btn-primary btn-small" href="${this.escape(this.getRouteHref("detail", { classroomId: classroomValue }))}#assignments-container">View Assignment</a>
            <a class="btn btn-secondary btn-small" href="#saved-collections-list">Back to Saved Collections</a>
          </div>`
        );
      }
      console.info("[Digital Classroom] Learning Spree created", { assignmentId: assignment?.id, selectedIds });
    });
  }

  static bindTeachingResourceActions(resources, classrooms) {
    document.querySelectorAll("[data-assign-resource]").forEach((button) => {
      button.addEventListener("click", () => {
        const resource = resources.find((item) => String(item.id) === String(button.dataset.assignResource));
        if (resource) this.openResourceAssignment(resource, classrooms);
      });
    });

    const form = document.getElementById("resource-assignment-form");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const selectedResourceIds = String(form.dataset.resourceIds || formData.get("resourceId") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const selectedResources = selectedResourceIds
        .map((id) => resources.find((item) => String(item.id) === id))
        .filter(Boolean);
      const resource = selectedResources[0];
      const classroomId = String(formData.get("classroomId") || "").trim();
      const title = String(formData.get("title") || "").trim();
      const dueDate = String(formData.get("dueDate") || "").trim();
      const points = Number(formData.get("points"));

      if (!selectedResources.length || !classroomId || !title || !dueDate || !Number.isFinite(points) || points <= 0) {
        this.showNotice("resource-assignment-notice", "Choose a classroom, title, due date, and positive points value.", "error");
        return;
      }

      const baseInstructions = String(formData.get("instructions") || "").trim();
      await Promise.all(selectedResources.map((selectedResource, index) => {
        const resourceLine = selectedResource.fileUrl
          ? `\n\nResource: ${selectedResource.title}\n${selectedResource.fileUrl}`
          : `\n\nResource: ${selectedResource.title}`;
        const assignmentTitle = selectedResources.length === 1
          ? title
          : `${title}: ${selectedResource.title}`;

        return ClassroomAPI.createAssignment({
          classroomId,
          title: assignmentTitle,
          instructions: `${baseInstructions}${resourceLine}`.trim(),
          dueDate,
          points
        });
      }));

      this.showNotice(
        "resource-assignment-notice",
        selectedResources.length === 1 ? "Assignment created." : `${selectedResources.length} assignments created.`,
        "success"
      );
      delete form.dataset.resourceIds;
      form.reset();
    });
  }

  static openResourceAssignment(resource, classrooms = []) {
    const panel = document.getElementById("resource-assign-panel");
    const form = document.getElementById("resource-assignment-form");
    if (!panel || !form) return;

    const resources = Array.isArray(resource) ? resource : [resource];
    const primaryResource = resources[0];
    if (!primaryResource) return;

    panel.hidden = false;
    const isBulk = resources.length > 1;
    this.setText("assign-resource-name", isBulk ? `${resources.length} saved materials selected` : primaryResource.title);

    const classroomSelect = form.querySelector('select[name="classroomId"]');
    if (classroomSelect) {
      classroomSelect.innerHTML = classrooms.length
        ? classrooms.map((classroom) => `<option value="${this.escape(classroom.id)}">${this.escape(classroom.name)}</option>`).join("")
        : '<option value="" disabled selected>No classrooms available</option>';
    }

    const resourceIds = resources.map((item) => item.id);
    form.elements.resourceId.value = resourceIds[0];
    form.dataset.resourceIds = resourceIds.join(",");
    form.elements.title.value = isBulk ? "Saved Materials Assignment" : primaryResource.title;
    form.elements.instructions.value = isBulk
      ? resources.map((item, index) => `${index + 1}. ${item.title}`).join("\n")
      : primaryResource.description || "";
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  static createSpreeFromResources(resources = [], classroomId = "") {
    return {
      status: "placeholder",
      classroomId,
      resources,
      trackingFields: ["started", "completionStatus", "score", "progressPercentage", "deadline", "timeSpent", "engagementStatus"],
      message: "Learning spree creation is prepared for a future backend connection."
    };
  }

  static assignSpreeToClassroom(spree = {}, classroomId = "") {
    return {
      status: "placeholder",
      classroomId,
      spree,
      message: "Spree assignment will connect when backend tables are available."
    };
  }

  static trackSpreeProgress(spreeId = "", classroomId = "") {
    return {
      status: "placeholder",
      classroomId,
      spreeId,
      started: false,
      completionStatus: "not_started",
      score: null,
      progressPercentage: 0,
      deadline: null,
      timeSpent: 0,
      engagementStatus: "pending"
    };
  }

  static getCurrentClassroomId(classroomId) {
    if (classroomId) return classroomId;

    const params = new URLSearchParams(window.location.search);
    const queryClassroomId = params.get("classroomId") || params.get("id");
    if (queryClassroomId) return queryClassroomId;

    const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
    const hashParams = new URLSearchParams(hashQuery);
    const hashClassroomId = hashParams.get("classroomId") || hashParams.get("id");
    if (hashClassroomId) return hashClassroomId;

    const hashMatch = window.location.hash.match(/#classroom\/detail\/([^/?#]+)/);
    return hashMatch ? decodeURIComponent(hashMatch[1]) : "";
  }

  static getLiveQuizUrl(classId) {
    return `https://joyal520.github.io/live_quiz/?classId=${encodeURIComponent(classId || "")}&source=edectra`;
  }

  static bindLiveQuizLaunch(classroomId) {
    const liveQuizCard = document.querySelector('[data-future-route="live-quiz"]');
    if (!liveQuizCard) return;

    const classId = this.getCurrentClassroomId(classroomId);
    const initialExternalUrl = this.getLiveQuizUrl(classId);
    console.log("final externalUrl", initialExternalUrl);

    liveQuizCard.href = initialExternalUrl;
    liveQuizCard.target = "_blank";
    liveQuizCard.rel = "noopener noreferrer";
    liveQuizCard.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const externalUrl = `https://joyal520.github.io/live_quiz/?classId=${encodeURIComponent(classId)}&source=edectra`;

      console.log("Live Quiz card clicked");
      console.log("detected classId", classId);
      console.log("final externalUrl", externalUrl);
      console.log("Opening external LiveQuiz");

      if (!externalUrl.startsWith("https://") || externalUrl.startsWith("#/")) {
        console.error("[Digital Classroom] blocked invalid LiveQuiz URL", externalUrl);
        return;
      }

      window.open(externalUrl, "_blank", "noopener,noreferrer");
    });
  }

  static async refreshClassroomSections(classroomId) {
    const [students, assignments, metrics, contentItems, bucketItems, feedback] = await Promise.all([
      ClassroomAPI.getStudentsByClassroom(classroomId),
      ClassroomAPI.getAssignmentsByClassroom(classroomId),
      ClassroomAPI.getClassroomMetrics(classroomId),
      ClassroomAPI.getContentItems(),
      ClassroomAPI.getClassroomContent(classroomId),
      ClassroomAPI.getLatestAiFeedback(classroomId)
    ]);

    this.renderLeaderboard("leaderboard-container", students);
    this.setText("detail-students", metrics.studentCount);
    this.setText("detail-assignments", metrics.assignmentCount);
    this.setText("detail-completion", `${metrics.completionRate}%`);
    this.setText("detail-pending", Math.max((metrics.studentCount * metrics.assignmentCount) - metrics.submissionCount, 0));
    this.renderStudents("students-container", students);
    this.renderMessages(classroomId);
    this.renderAssignments("assignments-container", assignments, metrics.studentCount);
    this.renderAssignmentStatus(assignments, metrics);
    this.renderAttendance(students);
    this.renderClassActivity(assignments, students);
    this.renderContentBucket(classroomId, contentItems, bucketItems);
    this.renderAnalytics(metrics);
    this.renderAiFeedback(feedback);

  }

  static bindAssignmentForm(classroomId) {
    const form = document.getElementById("assignment-form");
    if (!form || form.dataset.bound === "true") return;

    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const title = String(formData.get("title") || "").trim();
      const dueDate = String(formData.get("dueDate") || "").trim();
      const points = Number(formData.get("points"));

      if (!title || !dueDate || !Number.isFinite(points) || points <= 0) {
        this.showNotice("assignment-notice", "Add a title, due date, and positive points value.", "error");
        return;
      }

      await ClassroomAPI.createAssignment({
        classroomId,
        title,
        instructions: formData.get("instructions") || "",
        dueDate,
        points
      });

      form.reset();
      this.showNotice("assignment-notice", "Assignment created.", "success");
      await this.refreshClassroomSections(classroomId);
    });

    document.getElementById("generate-feedback-btn")?.addEventListener("click", async () => {
      const feedback = await ClassroomAPI.generateAiFeedback(classroomId);
      this.renderAiFeedback(feedback);
    });
  }

  static bindMessagePanel(classroomId) {
    const form = document.getElementById("class-message-form");
    if (!form || form.dataset.bound === "true") return;

    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const message = String(formData.get("message") || "").trim();
      if (!message) {
        this.showNotice("message-notice", "Write a message before sending.", "error");
        return;
      }

      const key = `edtechra_class_messages_${classroomId}`;
      const messages = JSON.parse(sessionStorage.getItem(key) || "[]");
      messages.unshift({
        id: `msg_${Date.now()}`,
        text: message,
        createdAt: new Date().toISOString()
      });
      sessionStorage.setItem(key, JSON.stringify(messages.slice(0, 12)));
      form.reset();
      this.showNotice("message-notice", "Message saved locally for this session. Connect a backend message table to broadcast it.", "success");
      this.renderMessages(classroomId);
    });
  }

  static bindDangerZone(classroomId, classroomName) {
    const modal = document.getElementById("delete-classroom-modal");
    const input = document.getElementById("delete-confirm-input");
    const confirmButton = document.getElementById("confirm-delete-btn");
    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
      if (input) input.value = "";
      if (confirmButton) confirmButton.disabled = true;
      this.showNotice("delete-modal-notice", "", "success");
    };

    document.getElementById("archive-classroom-btn")?.addEventListener("click", () => {
      this.showNotice("danger-notice", "Archive is prepared, but this backend does not expose a classroom archive action yet.", "success");
    });

    document.getElementById("open-delete-modal-btn")?.addEventListener("click", () => {
      if (!modal) return;
      modal.hidden = false;
      input?.focus();
    });

    document.getElementById("cancel-delete-btn")?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });

    input?.addEventListener("input", () => {
      if (confirmButton) confirmButton.disabled = input.value.trim() !== classroomName;
    });

    confirmButton?.addEventListener("click", () => {
      if (input?.value.trim() !== classroomName) return;
      this.showNotice("delete-modal-notice", "Delete is intentionally blocked here until a safe backend delete endpoint exists.", "error");
      console.info("[Digital Classroom] Delete confirmation collected without deleting classroom", { classroomId });
    });
  }

  static renderMessages(classroomId) {
    const container = document.getElementById("messages-container");
    if (!container) return;

    const key = `edtechra_class_messages_${classroomId}`;
    const messages = JSON.parse(sessionStorage.getItem(key) || "[]");
    const assets = this.getTeacherAssets();

    container.innerHTML = messages.length
      ? messages.map((message) => `
        <div class="teacher-message-item">
          <span class="message-icon">${this.getIcon("message")}</span>
          <div>
            <strong>${this.escape(message.text)}</strong>
            <small>${this.formatDate(message.createdAt)} / session draft</small>
          </div>
          <span class="message-menu">${this.getIcon("dots")}</span>
        </div>
      `).join("")
      : `
        <div class="illustrated-empty">
          ${this.renderTeacherAssetImage(assets.messagesEmpty, "No classroom messages", "empty-asset-image")}
          <strong>No messages yet</strong>
          <span>Class announcements will appear here when a backend message channel is connected.</span>
        </div>
      `;
  }

  static renderStudents(containerId, students) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const assignmentsCount = Number(document.getElementById("detail-assignments")?.textContent || 0);
    const renderRows = (rows) => {
      container.innerHTML = rows.length
        ? rows.map((student) => {
          const progress = assignmentsCount ? Math.min(100, Math.round(((student.completedAssignments || 0) / assignmentsCount) * 100)) : 0;
          const status = progress > 0 ? "Online" : "Not marked";
          return `
            <tr>
              <td>
                <div class="student-info">
                  <div class="avatar">${this.escape(student.avatar)}</div>
                  <div>
                    <h4>${this.escape(student.name)}</h4>
                    <span>${this.escape(student.profileId || student.memberId || "Class member")}</span>
                  </div>
                </div>
              </td>
              <td><span class="student-status ${progress > 0 ? "online" : "idle"}">${status}</span></td>
              <td><div class="table-progress"><span style="width: ${progress}%"></span><strong>${progress}%</strong></div></td>
              <td>${Number(student.points || 0)}</td>
              <td>
                <div class="student-actions">
                  <button class="table-icon-btn" type="button" title="View progress" data-view-student="${this.escape(student.id)}">${this.getIcon("bars")}</button>
                  <button class="table-icon-btn danger" type="button" title="Remove student" data-remove-student="${this.escape(student.id)}">${this.getIcon("trash")}</button>
                </div>
              </td>
            </tr>
          `;
        }).join("")
        : `<tr><td colspan="5">${this.emptyState("No students yet", "Share the invite link to let students join this classroom.")}</td></tr>`;
    };

    renderRows(students);
    const search = document.getElementById("student-search-input");
    if (search && search.dataset.bound !== "true") {
      search.dataset.bound = "true";
      search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();
        renderRows(students.filter((student) => student.name.toLowerCase().includes(query)));
      });
    }

    container.querySelectorAll("[data-view-student]").forEach((button) => {
      button.addEventListener("click", () => this.showToast("Student progress details will open when the progress route is connected.", "success"));
    });

    container.querySelectorAll("[data-remove-student]").forEach((button) => {
      button.addEventListener("click", async () => {
        const confirmed = window.confirm("Remove this student from the classroom? Their profile will not be deleted.");
        if (!confirmed) return;
        await ClassroomAPI.removeStudentFromClassroom?.(button.closest("main")?.dataset.classroomId || this.getCurrentClassroomId(), button.dataset.removeStudent);
        await this.refreshClassroomSections(this.getCurrentClassroomId());
      });
    });
    return;

    container.innerHTML = students.length
      ? students.map((student) => `
        <div class="list-item">
          <div class="student-info">
            <div class="avatar">${this.escape(student.avatar)}</div>
            <div>
              <h4>${this.escape(student.name)}</h4>
              <span>${student.completedAssignments} completed / ${student.points} pts</span>
            </div>
          </div>
        </div>
      `).join("")
      : this.emptyState("No students yet", "Share the invite link to let students join this classroom.");
  }

  static renderAssignments(containerId, assignments, studentCount = 0) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = ClassroomState.getData();
    const assets = this.getTeacherAssets();
    const recentAssignments = [...assignments]
      .sort((a, b) => new Date(b.createdAt || b.assignedAt || b.dueDate || 0) - new Date(a.createdAt || a.assignedAt || a.dueDate || 0))
      .slice(0, 3);
    container.innerHTML = recentAssignments.length
      ? recentAssignments.map((assignment) => {
        const completionCount = data.submissions.filter((submission) => submission.assignmentId === assignment.id).length;
        const completionPercent = studentCount ? Math.round((completionCount / studentCount) * 100) : 0;
        const isSpree = assignment.assignmentType === "learning_spree";
        const itemCount = assignment.resourceItems?.length || 0;
        const unlockLabel = assignment.unlockMode === "one_lesson_per_day" ? "One Lesson Per Day" : "Open Access";
        return `
          <div class="assignment-row list-item ${isSpree ? "learning-spree-row" : ""}">
            <div class="list-item-content">
              <h4>${this.escape(assignment.title)}${isSpree ? ' <span class="resource-visibility-badge is-public">Learning Spree</span>' : ""}</h4>
              <span>Due ${this.formatDate(assignment.dueDate)} / ${isSpree ? `${itemCount} materials` : `${assignment.points} pts`}</span>
              ${isSpree ? `<p class="spree-row-summary">${this.escape(assignment.instructions || "Structured learning path")} / Unlock Mode: ${unlockLabel}</p>` : ""}
              <div class="mini-progress" aria-hidden="true"><span style="width: ${completionPercent}%"></span></div>
            </div>
            <div class="right-stat">
              <strong>${completionCount}/${studentCount || 0}</strong>
              <span>Submitted</span>
            </div>
          </div>
        `;
      }).join("")
      : `
        <div class="illustrated-empty">
          ${this.renderTeacherAssetImage(assets.tasksEmpty, "No assignments yet", "empty-asset-image")}
          <strong>No assignments yet</strong>
          <span>Create a task, exam, or competition activity to send work to joined students.</span>
        </div>
      `;
  }

  static renderLeaderboard(containerId, students) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = students.length
      ? `
        <div class="leaderboard-head"><span>Rank</span><span>Student Name</span><span>Points</span></div>
        ${students.map((student, index) => `
          <div class="leaderboard-entry">
            <span class="rank rank-${index + 1}">${index + 1}</span>
            <strong>${this.escape(student.name)}</strong>
            <span>${Number(student.points || 0)} ${this.getIcon("star")}</span>
          </div>
        `).join("")}
      `
      : this.emptyState("No leaderboard yet", "Student points will appear after submissions.");
  }

  static renderContentBucket(classroomId, contentItems, bucketItems) {
    const bucketContainer = document.getElementById("bucket-items");
    const libraryContainer = document.getElementById("content-library");
    if (!bucketContainer || !libraryContainer) return;

    const bucketIds = new Set(bucketItems.map((item) => item.id));
    bucketContainer.innerHTML = bucketItems.length
      ? bucketItems.map((item) => this.contentItemTemplate(item, "Remove", "remove", classroomId)).join("")
      : this.emptyState("Bucket is empty", "Add Edtechra content from the library below.");

    libraryContainer.innerHTML = contentItems.map((item) => {
      const added = bucketIds.has(item.id);
      return this.contentItemTemplate(item, added ? "Added" : "Add to bucket", added ? "added" : "add", classroomId);
    }).join("");

    document.querySelectorAll("[data-content-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.contentAction;
        const contentId = button.dataset.contentId;

        if (action === "add") {
          await ClassroomAPI.addContentToClassroom(classroomId, contentId);
        }

        if (action === "remove") {
          await ClassroomAPI.removeContentFromClassroom(classroomId, contentId);
        }

        await this.refreshClassroomSections(classroomId);
      });
    });
  }

  static contentItemTemplate(item, label, action, classroomId) {
    return `
      <div class="list-item">
        <div>
          <h4>${this.escape(item.title)}</h4>
          <span>${this.escape(item.type)} / ${this.escape(item.subject)} / ${this.escape(item.level)} / ${item.minutes} min</span>
        </div>
        <button class="btn btn-small ${action === "added" ? "btn-muted" : "btn-secondary"}"
          data-content-action="${action}"
          data-content-id="${this.escape(item.id)}"
          data-classroom-id="${this.escape(classroomId)}"
          ${action === "added" ? "disabled" : ""}>${label}</button>
      </div>
    `;
  }

  static renderAnalytics(metrics) {
    const container = document.getElementById("analytics-container");
    if (!container) return;

    container.innerHTML = `
      <div class="performance-stat-grid">
        <div><span>Average Score</span><strong>${metrics.classAverage || 0}</strong></div>
        <div><span>Quizzes Completed</span><strong>${metrics.submissionCount || 0}</strong></div>
        <div><span>Assignments Done</span><strong>${metrics.completionRate || 0}%</strong></div>
        <div><span>Participation</span><strong>${metrics.activeStudents || 0}/${metrics.studentCount || 0}</strong></div>
      </div>
    `;
  }

  static renderAssignmentStatus(assignments, metrics) {
    const container = document.getElementById("assignment-status-container");
    if (!container) return;

    const completed = metrics.submissionCount;
    const totalSlots = Math.max(metrics.studentCount * metrics.assignmentCount, 1);
    const notCompleted = Math.max(totalSlots - completed, 0);
    const overdue = assignments.filter((assignment) => new Date(assignment.dueDate) < new Date()).length;
    const inProgress = Math.max(Math.round(notCompleted * 0.58), 0);
    const notStarted = Math.max(notCompleted - inProgress, 0);
    const segments = [
      ["Completed", completed, "#42d487"],
      ["In Progress", inProgress, "#4f8cff"],
      ["Pending", notStarted, "#f4b74d"],
      ["Overdue", overdue, "#ef5b72"]
    ];
    const total = Math.max(segments.reduce((sum, [, value]) => sum + value, 0), 1);
    let cursor = 0;
    const gradient = segments.map(([, value, color]) => {
      const start = cursor;
      cursor += (value / total) * 100;
      return `${color} ${start}% ${cursor}%`;
    }).join(", ");

    container.innerHTML = `
      <div class="status-chart-wrap">
        <div class="donut-chart" style="background: conic-gradient(${gradient});">
          <div>
            <span>Total</span>
            <strong>${totalSlots}</strong>
            <span>Tasks</span>
          </div>
        </div>
        <div class="status-legend">
          ${segments.map(([label, value, color]) => `
            <div>
              <span><i style="background: ${color}"></i>${label}</span>
              <strong>${Math.round((value / total) * 100)}%</strong>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  static renderAttendance(students) {
    const container = document.getElementById("attendance-container");
    if (!container) return;

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const visibleStudents = students.slice(0, 5);
    const statusCycle = ["present", "present", "not-marked", "absent", "present", "not-marked"];
    const statusLabel = {
      present: "✓ Present",
      absent: "✕ Absent",
      "not-marked": "– Not marked"
    };
    container.innerHTML = visibleStudents.length
      ? `
        <div class="attendance-table">
          <div class="attendance-row attendance-head">
            <span>Student Name</span>
            ${days.map((day) => `<span>${day}</span>`).join("")}
          </div>
          ${visibleStudents.map((student, studentIndex) => `
            <div class="attendance-row">
              <strong>${this.escape(student.name)}</strong>
              ${days.map((day, dayIndex) => {
                const status = statusCycle[(studentIndex + dayIndex) % statusCycle.length];
                return `<span class="attendance-mark ${status}" title="${day} ${statusLabel[status]}">${statusLabel[status].split(" ")[0]}</span>`;
              }).join("")}
            </div>
          `).join("")}
        </div>
        <div class="attendance-legend">
          <span><i class="attendance-mark present">✓</i>Present</span>
          <span><i class="attendance-mark absent">✕</i>Absent</span>
          <span><i class="attendance-mark not-marked">–</i>Not Marked</span>
        </div>
      `
      : this.emptyState("No attendance yet", "Students will appear after they join this classroom.");
  }

  static renderClassActivity(assignments, students) {
    const container = document.getElementById("class-activity-container");
    if (!container) return;

    const data = ClassroomState.getData();
    const submissionItems = data.submissions
      .filter((submission) => assignments.some((assignment) => assignment.id === submission.assignmentId))
      .slice(0, 3)
      .map((submission) => {
        const student = students.find((item) => item.id === submission.studentId);
        const assignment = assignments.find((item) => item.id === submission.assignmentId);
        return {
          type: "submission",
          title: `${student?.name || "A student"} submitted ${assignment?.title || "an assignment"}.`,
          meta: this.formatDate(submission.submittedAt)
        };
      });
    const assignmentItems = assignments.slice(0, 3).map((assignment) => ({
      type: "assignment",
      title: `New assignment "${assignment.title}" created.`,
      meta: `Due ${this.formatDate(assignment.dueDate)}`
    }));
    const activityItems = [...submissionItems, ...assignmentItems].slice(0, 5);

    container.innerHTML = activityItems.length
      ? activityItems.map((item) => `
        <div class="activity-feed-item list-item">
          <span class="feed-icon ${item.type}">${item.type === "submission" ? "S" : "A"}</span>
          <div class="list-item-content">
            <h4>${this.escape(item.title)}</h4>
            <span>${this.escape(item.meta)}</span>
          </div>
        </div>
      `).join("")
      : this.emptyState("No class activity yet", "Assignments, quiz events, and submissions will appear here.");
  }

  static formatDate(value) {
    if (!value) return "No date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return this.escape(value);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  static renderAiFeedback(feedback) {
    const container = document.getElementById("ai-feedback-output");
    if (!container) return;

    if (!feedback) {
      container.innerHTML = `
        <ul class="ai-insight-list">
          <li>Generate a classroom report after students begin submitting work.</li>
          <li>This uses the existing mock/report log flow only.</li>
          <li>No paid AI call is made from this page.</li>
        </ul>
      `;
      return;
    }

    container.innerHTML = `
      <div class="ai-feedback-box">
        <p>${this.escape(feedback.summary)}</p>
        <ul class="ai-insight-list">
          ${feedback.recommendations.map((item) => `<li>${this.escape(item)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  static renderJoinLoading(panel) {
    panel.innerHTML = `
      <div class="join-card-layout">
        <div class="join-card-copy">
          <p class="eyebrow">Classroom Invitation</p>
          <div class="join-skeleton join-skeleton-title"></div>
          <div class="join-skeleton join-skeleton-line"></div>
          <div class="join-skeleton join-skeleton-line short"></div>
          <div class="join-classroom-meta">
            <div class="join-skeleton join-skeleton-row"></div>
            <div class="join-skeleton join-skeleton-row"></div>
            <div class="join-skeleton join-skeleton-row"></div>
          </div>
        </div>
        <div class="join-card-art" aria-hidden="true">${this.renderJoinIllustration()}</div>
      </div>
    `;
  }

  static renderJoinIllustration() {
    return `
      <svg class="join-illustration" viewBox="0 0 360 280" role="img" aria-label="Digital classroom illustration">
        <defs>
          <linearGradient id="joinBlob" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stop-color="#eef4ff"/>
            <stop offset="1" stop-color="#f4ecff"/>
          </linearGradient>
          <linearGradient id="joinBoard" x1="0" x2="1">
            <stop offset="0" stop-color="#70d6b5"/>
            <stop offset="1" stop-color="#7fb8ff"/>
          </linearGradient>
        </defs>
        <path d="M42 204c-25-39-20-104 19-139 40-37 101-23 141-10 45 14 98-11 124 25 28 38 4 102-35 136-40 35-90 42-145 38-49-4-82-14-104-50Z" fill="url(#joinBlob)"/>
        <rect x="134" y="58" width="124" height="78" rx="14" fill="url(#joinBoard)" stroke="#8e99d8" stroke-width="5"/>
        <path d="M157 84c19-14 40-14 58 0M157 109h78" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".78"/>
        <rect x="154" y="151" width="78" height="18" rx="8" fill="#e7ecff"/>
        <rect x="174" y="134" width="42" height="33" rx="8" fill="#a997ff"/>
        <rect x="74" y="156" width="74" height="46" rx="12" fill="#ffdca8"/>
        <rect x="90" y="139" width="42" height="29" rx="12" fill="#9078ff"/>
        <path d="M85 200v35M139 200v35" stroke="#d5aa78" stroke-width="8" stroke-linecap="round"/>
        <rect x="230" y="156" width="74" height="46" rx="12" fill="#ffdca8"/>
        <rect x="246" y="139" width="42" height="29" rx="12" fill="#a997ff"/>
        <path d="M241 200v35M295 200v35" stroke="#d5aa78" stroke-width="8" stroke-linecap="round"/>
        <path d="M75 133c-16-14-21-40-10-59 22 7 30 31 20 52 18-12 40-8 52 10-14 18-40 20-56 5Z" fill="#94d78f" opacity=".8"/>
        <path d="M79 139v50" stroke="#d2b58c" stroke-width="9" stroke-linecap="round"/>
        <rect x="34" y="189" width="58" height="14" rx="7" fill="#9cc9ff"/>
        <rect x="40" y="174" width="58" height="14" rx="7" fill="#ffd17d"/>
        <path d="M279 75h31M279 93h23M279 111h29" stroke="#cbd7ef" stroke-width="6" stroke-linecap="round"/>
        <circle cx="296" cy="50" r="18" fill="#fff" stroke="#dbe4f7" stroke-width="5"/>
        <path d="M296 39v11l8 6" stroke="#b9c4da" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `;
  }

  static async renderJoinClassroom(inviteCodeOrId) {
    const panel = document.getElementById("join-classroom-panel");
    const meta = document.getElementById("join-classroom-meta");
    const joinButton = document.getElementById("join-classroom-btn");
    if (!panel || !meta) return;

    this.renderJoinLoading(panel);
    const invite = await ClassroomAPI.getClassroomInvite(inviteCodeOrId).catch(() => null);
    if (!invite?.classroom) {
      panel.innerHTML = `
        <p class="eyebrow">Classroom Invitation</p>
        ${this.renderJoinIllustration()}
        ${this.emptyState("Invalid invitation", "This invite code is not active. Ask your teacher for a fresh classroom invitation link.")}
        <a class="btn btn-secondary" href="#home">Back Home</a>
      `;
      return;
    }

    const { classroom, alreadyJoined, studentProfile } = invite;
    if (["teacher", "admin"].includes(studentProfile?.role)) {
      panel.innerHTML = `
        <p class="eyebrow">Classroom Invitation</p>
        ${this.emptyState("Student account required", "Teacher and admin accounts should use the teacher Classes workspace, not the student join flow.")}
        <a class="btn btn-secondary" href="${studentProfile.role === "teacher" ? "#classroom" : "#home"}">Back</a>
      `;
      return;
    }

    panel.innerHTML = `
      <div class="join-card-layout">
        <div class="join-card-copy">
          <p class="eyebrow">Classroom Invitation</p>
          <h1>Join Classroom?</h1>
          <p class="subtitle" id="join-classroom-summary">${this.escape(classroom.name)} is ready to add to your Edtechra student account.</p>
          <div class="join-classroom-meta" id="join-classroom-meta"></div>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" id="join-classroom-btn">${alreadyJoined ? "Open Classroom" : "Join Classroom"}</button>
            <a class="btn btn-secondary" href="#home">Cancel</a>
          </div>
          <p id="join-classroom-notice" class="notice" aria-live="polite"></p>
        </div>
        <div class="join-card-art" aria-hidden="true">${this.renderJoinIllustration()}</div>
      </div>
    `;

    const refreshedMeta = document.getElementById("join-classroom-meta");
    const refreshedJoinButton = document.getElementById("join-classroom-btn");
    this.setText("join-classroom-summary", `${classroom.name} is ready to add to your Edtechra student account.`);
    refreshedMeta.innerHTML = `
      <div class="join-meta-row"><span>Classroom</span><strong>${this.escape(classroom.name)}</strong></div>
      <div class="join-meta-row"><span>Subject / Grade</span><strong>${this.escape(this.getClassroomLabel(classroom))}</strong></div>
      <div class="join-meta-row"><span>Teacher</span><strong>${this.escape(classroom.teacherName || "Teacher")}</strong></div>
      <div class="join-meta-row"><span>Joining as</span><strong>${this.escape(studentProfile?.displayName || "Student")}</strong></div>
    `;

    if (alreadyJoined) {
      this.showNotice("join-classroom-notice", "You are already a member of this classroom.", "success");
      if (refreshedJoinButton) {
        refreshedJoinButton.textContent = "Open Classroom";
        refreshedJoinButton.onclick = async () => {
          await ClassroomAPI.touchStudentClassroomAccess(classroom.id).catch(() => null);
          window.location.hash = `#classroom/student/${encodeURIComponent(classroom.id)}`;
        };
      }
      return;
    }

    if (refreshedJoinButton) {
      refreshedJoinButton.onclick = async () => {
        refreshedJoinButton.disabled = true;
        const displayName = studentProfile?.displayName || "Student";
        let student;
        try {
          student = await ClassroomAPI.joinClassroom(classroom.id, displayName);
        } catch (error) {
          refreshedJoinButton.disabled = false;
          this.showNotice("join-classroom-notice", "We could not join this classroom. Please try again.", "error");
          console.warn("[Digital Classroom] Join failed", error);
          return;
        }
        sessionStorage.setItem(`edtechra_student_${classroom.id}`, student.id);
        this.showNotice(
          "join-classroom-notice",
          student.alreadyEnrolled ? "You are already enrolled in this classroom." : `Welcome to ${classroom.name}.`,
          "success"
        );
        if (student.alreadyEnrolled) {
          this.showToast("You are already enrolled in this classroom.", "success");
        }
        refreshedJoinButton.textContent = "Open Classroom";
        refreshedJoinButton.disabled = false;
        refreshedJoinButton.onclick = async () => {
          await ClassroomAPI.touchStudentClassroomAccess(classroom.id).catch(() => null);
          window.location.hash = `#classroom/student/${encodeURIComponent(classroom.id)}`;
        };
        window.setTimeout(() => {
          window.location.hash = `#classroom/student/${encodeURIComponent(classroom.id)}`;
        }, 800);
      };
    }
  }

  static async renderMyClasses() {
    const container = document.getElementById("my-classes-container");
    if (!container) return;

    const classrooms = await ClassroomAPI.getJoinedClassrooms().catch(() => []);
    container.innerHTML = classrooms.length
      ? classrooms.map((classroom) => `
        <article class="student-class-card glass-card">
          <div class="student-class-card-top">
            <span class="classroom-banner-badge">${this.escape(this.getClassroomLabel(classroom))}</span>
            <span class="soft-pill">${classroom.unreadCount || 0} unread</span>
          </div>
          <h3>${this.escape(classroom.name)}</h3>
          <p class="muted">Teacher: ${this.escape(classroom.teacherName || "Teacher")}</p>
          <div class="classroom-meta">
            <span><span class="meta-icon">${this.getIcon("assignment")}</span>${classroom.taskCount || 0} tasks</span>
            <span>Joined ${this.formatDate(classroom.joinedAt)}</span>
          </div>
          <a class="btn btn-primary btn-small" href="${this.getRouteHref("student", { classroomId: classroom.id })}" data-open-student-class="${this.escape(classroom.id)}">Open Classroom</a>
        </article>
      `).join("")
      : `
        <div class="empty-state classroom-empty-state">
          <span class="empty-state-visual" data-dashboard-icon="classroomDefault" aria-hidden="true"></span>
          <strong>No classes joined yet.</strong>
          <span>Open an invitation link from your teacher to join a classroom.</span>
        </div>
      `;
    this.hydrateDashboardIcons(container);
    container.querySelectorAll("[data-open-student-class]").forEach((link) => {
      link.addEventListener("click", () => {
        ClassroomAPI.touchStudentClassroomAccess(link.dataset.openStudentClass).catch(() => null);
      });
    });
  }

  static async renderStudentDashboard(classroomId) {
    const joinedClassroom = await ClassroomAPI.getJoinedClassroomById(classroomId).catch(() => null);
    const main = document.querySelector("main");

    if (!main) {
      return;
    }

    if (!joinedClassroom) {
      main.innerHTML = `
        <section class="join-classroom-shell">
          <div class="glass-panel join-card">
            ${this.emptyState("You are not a member of this classroom.", "Please use your teacher's invitation link to join this classroom.")}
            <a class="btn btn-secondary" href="#my-classes">Back to My Classes</a>
          </div>
        </section>
      `;
      return;
    }

    const { classroom, membership } = joinedClassroom;
    await ClassroomAPI.touchStudentClassroomAccess(classroom.id).catch(() => null);
    main.innerHTML = this.renderStudentClassroomShell(classroom, membership);
    await this.renderStudentWorkspace(classroomId, membership);
  }

  static renderStudentAssetImage(src, alt, className = "") {
    return `
      <div class="student-asset-frame ${className}">
        <img src="${this.escape(src)}" alt="${this.escape(alt)}" loading="lazy" decoding="async" onerror="this.closest('.student-asset-frame')?.classList.add('is-missing'); this.remove();">
        <div class="student-asset-fallback" aria-hidden="true">
          <span>Image coming soon</span>
        </div>
      </div>
    `;
  }

  static renderStudentClassroomShell(classroom, student) {
    return `
      <header class="dashboard-hero glass-panel page-hero page-hero-slim student-classes-hero">
        <div class="dashboard-hero-copy">
          <p class="eyebrow">Student Classroom</p>
          <h1>${this.escape(classroom.name)}</h1>
          <p class="subtitle">${this.escape(this.getClassroomLabel(classroom))} with ${this.escape(classroom.teacherName || "your teacher")}</p>
          <div class="hero-meta-row">
            <span class="soft-pill">Class code: ${this.escape(classroom.inviteCode || classroom.id)}</span>
            <span class="soft-pill">Progress starts here</span>
          </div>
        </div>
        <div class="student-hero-visual">
          ${this.renderStudentAssetImage("assets/images/vvk3qw6wli6a27hwlz2j.webp", "Student classroom illustration", "student-hero-image")}
        </div>
      </header>

      <section class="student-summary-grid grid">
        <div class="student-summary-card glass-card">
          <span class="student-summary-icon" data-dashboard-icon="completion" aria-hidden="true"></span>
          <strong id="student-progress-rate">0%</strong>
          <span>Progress analytics</span>
        </div>
        <div class="student-summary-card glass-card">
          <span class="student-summary-icon" data-dashboard-icon="attendance" aria-hidden="true"></span>
          <strong>Active</strong>
          <span>Attendance summary</span>
        </div>
        <div class="student-summary-card glass-card">
          <span class="student-summary-icon" data-dashboard-icon="deadlines" aria-hidden="true"></span>
          <strong id="student-deadline-count">0</strong>
          <span>Upcoming deadlines</span>
        </div>
      </section>

      <section class="student-dashboard-grid grid" id="student-workspace">
        <section class="glass-panel section-surface">
          <div class="section-header section-header-tight">
            <div>
              <h2>Today's Tasks</h2>
              <p class="muted">Assigned work due today or ready to continue.</p>
            </div>
          </div>
          <div class="item-list" id="student-assignments"></div>
        </section>

        <section class="glass-panel section-surface">
          <div class="section-header section-header-tight">
            <div>
              <h2>Message Board</h2>
              <p class="muted">Teacher announcements and pinned notices.</p>
            </div>
          </div>
          <div id="student-message-empty">
            <div class="student-illustrated-empty">
              ${this.renderStudentAssetImage("assets/images/ok4ojdvf4ayliwu3awhb.webp", "No classroom messages", "student-empty-image")}
              <strong>No announcements yet</strong>
              <span>Classroom updates from your teacher will appear here.</span>
            </div>
          </div>
        </section>

        <section class="glass-panel section-surface">
          <div class="section-header section-header-tight">
            <div>
              <h2>Upcoming Events</h2>
              <p class="muted">Live quizzes, exams, deadlines, and speaking sessions.</p>
            </div>
          </div>
          ${this.emptyState("No upcoming events", "Scheduled classroom events will appear here.")}
        </section>

        <section class="glass-panel section-surface">
          <div class="section-header section-header-tight">
            <div>
              <h2>Live Quiz</h2>
              <p class="muted">Join interactive quizzes launched by your teacher.</p>
            </div>
          </div>
          ${this.emptyState("No live quiz right now", "When your teacher starts a quiz, the join button will appear here.")}
        </section>

        <section class="glass-panel section-surface">
          <div class="section-header section-header-tight">
            <div>
              <h2>Leaderboard</h2>
              <p class="muted">Your points and class ranking.</p>
            </div>
          </div>
          <div class="item-list" id="student-leaderboard"></div>
        </section>

        <section class="glass-panel section-surface">
          <div class="section-header section-header-tight">
            <div>
              <h2>AI Learning Coach</h2>
              <p class="muted">Personal feedback and suggested next activity.</p>
            </div>
          </div>
          <div class="student-ai-coach-card" id="student-ai-coach">
            <div>
              <strong>Feedback is warming up</strong>
              <span>Personal AI feedback will appear after you complete classroom work.</span>
            </div>
            ${this.renderStudentAssetImage("assets/images/iciuxqgkqr4nnemdeqw8.webp", "AI learning coach robot", "student-ai-robot-image")}
          </div>
        </section>

        <section class="glass-panel section-surface">
          <div class="section-header section-header-tight">
            <div>
              <h2>Recent Activity</h2>
              <p class="muted">Your latest submissions, messages, and attendance signals.</p>
            </div>
          </div>
          <div class="item-list" id="student-recent-activity"></div>
        </section>

        <section class="glass-panel section-surface student-quick-actions">
          <div class="section-header section-header-tight">
            <div>
              <h2>Quick Actions</h2>
              <p class="muted">Jump back into your learning flow.</p>
            </div>
          </div>
          <div class="student-action-row">
            <a class="btn btn-primary btn-small" href="#student-assignments">Continue Tasks</a>
            <a class="btn btn-secondary btn-small" href="#student-content">Open Resources</a>
          </div>
        </section>

        <section class="glass-panel section-surface">
          <div class="section-header section-header-tight">
            <div>
              <h2>Classroom Content</h2>
              <p class="muted">Assigned learning resources from your teacher.</p>
            </div>
          </div>
          <div class="item-list" id="student-content"></div>
        </section>
      </section>
    `;
  }

  static async renderStudentWorkspace(classroomId, student) {
    document.getElementById("student-join-panel")?.classList.add("hidden");
    document.getElementById("student-workspace")?.classList.remove("hidden");
    this.setText("student-name", student.name);
    this.setText("student-points", `${student.points} pts`);

    const [assignments, bucketItems, students] = await Promise.all([
      ClassroomAPI.getAssignmentsByClassroom(classroomId),
      ClassroomAPI.getClassroomContent(classroomId),
      ClassroomAPI.getStudentsByClassroom(classroomId).catch(() => [])
    ]);

    this.hydrateDashboardIcons(document.getElementById("student-workspace")?.parentElement || document);
    this.setText("student-deadline-count", assignments.length);

    const assignmentContainer = document.getElementById("student-assignments");
    if (assignmentContainer) {
      const rows = await Promise.all(assignments.map(async (assignment) => {
        const submission = await ClassroomAPI.getSubmission(assignment.id, student.id);
        const isSpree = assignment.assignmentType === "learning_spree";
        if (isSpree) {
          const items = assignment.resourceItems || [];
          const progressRows = await ClassroomAPI.getSpreeItemProgress(assignment.id, student.id).catch(() => []);
          const progressByItem = new Map(progressRows.map((row) => [String(row.spreeItemId), row]));
          const completedCount = items.filter((item) => progressByItem.get(String(item.id))?.status === "completed").length;
          return `
            <article class="list-item student-spree-task">
              <div class="student-spree-copy">
                <h4>${this.escape(assignment.title)} <span class="resource-visibility-badge is-public">Learning Spree</span></h4>
                <span>Due ${this.escape(assignment.dueDate)} / Progress: ${completedCount} / ${items.length} completed</span>
                <p>${this.escape(assignment.instructions || "Open the lessons below in order.")}</p>
                <div class="spree-progress-bar" aria-hidden="true"><span style="width: ${items.length ? Math.round((completedCount / items.length) * 100) : 0}%"></span></div>
                <ol class="student-spree-materials">
                  ${items.map((item) => {
                    const progress = progressByItem.get(String(item.id));
                    const status = progress?.status || "not_started";
                    const unlocked = this.isSpreeItemUnlocked(assignment, item);
                    const unlockDate = this.getSpreeItemUnlockDate(assignment, item);
                    const statusLabel = status === "completed" ? "Completed" : status === "opened" ? "Opened" : "Not Started";
                    const badgeLabel = status === "completed" ? "Completed" : unlocked ? "Available" : "Locked";
                    const buttonLabel = status === "completed" ? "Review" : !unlocked ? "Locked" : status === "opened" ? "Mark as Completed" : "Open Lesson";
                    const buttonAttr = status === "completed"
                      ? ""
                      : status === "opened"
                        ? `data-complete-spree-lesson="${this.escape(item.id)}"`
                        : `data-open-spree-lesson="${this.escape(item.id)}"`;
                    return `
                      <li class="${unlocked ? "is-available" : "is-locked"} ${status === "completed" ? "is-completed" : ""}">
                        <div>
                          <strong>${this.escape(item.title)}</strong>
                          <span>${this.escape(item.resourceType || "saved work")} / ${statusLabel}</span>
                          <small>${unlocked ? "Available" : this.escape(this.getUnlockText(unlockDate))}</small>
                        </div>
                        <span class="spree-status-badge ${status === "completed" ? "completed" : unlocked ? "available" : "locked"}">${badgeLabel}</span>
                        <button class="btn btn-small ${unlocked ? "btn-primary" : "btn-muted"}" type="button"
                          data-spree-assignment="${this.escape(assignment.id)}"
                          data-spree-resource="${this.escape(item.resourceId)}"
                          data-spree-classroom="${this.escape(assignment.classroomId)}"
                          ${buttonAttr}
                          ${!unlocked || status === "completed" ? "disabled" : ""}>${buttonLabel}</button>
                      </li>
                    `;
                  }).join("")}
                </ol>
              </div>
            </article>
          `;
        }
        return `
          <div class="list-item">
            <div>
              <h4>${this.escape(assignment.title)}</h4>
              <span>Due ${this.escape(assignment.dueDate)} / ${this.escape(assignment.instructions || "No instructions")}</span>
            </div>
            <button class="btn btn-small ${submission ? "btn-muted" : "btn-primary"}"
              data-submit-assignment="${this.escape(assignment.id)}"
              ${submission ? "disabled" : ""}>${submission ? "Submitted" : `Submit (${assignment.points} pts)`}</button>
          </div>
        `;
      }));

      assignmentContainer.innerHTML = rows.length
        ? rows.join("")
        : `
          <div class="student-illustrated-empty">
            ${this.renderStudentAssetImage("assets/images/nxcemfm81daer42v2bn6.webp", "No tasks assigned", "student-empty-image")}
            <strong>No assignments yet</strong>
            <span>Your teacher's assigned work will appear here.</span>
          </div>
        `;
    }

    const submittedCount = await Promise.all(assignments.map((assignment) => ClassroomAPI.getSubmission(assignment.id, student.id)))
      .then((rows) => rows.filter(Boolean).length)
      .catch(() => 0);
    const progressRate = assignments.length ? Math.round((submittedCount / assignments.length) * 100) : 0;
    this.setText("student-progress-rate", `${progressRate}%`);

    const contentContainer = document.getElementById("student-content");
    if (contentContainer) {
      contentContainer.innerHTML = bucketItems.length
        ? bucketItems.map((item) => `
          <div class="list-item compact">
            <div>
              <h4>${this.escape(item.title)}</h4>
              <span>${this.escape(item.type)} / ${this.escape(item.subject)} / ${item.minutes} min</span>
            </div>
          </div>
        `).join("")
        : this.emptyState("No content assigned", "Classroom bucket resources will appear here.");
    }

    const leaderboardContainer = document.getElementById("student-leaderboard");
    if (leaderboardContainer) {
      this.renderLeaderboard("student-leaderboard", students);
    }

    const recentActivity = document.getElementById("student-recent-activity");
    if (recentActivity) {
      recentActivity.innerHTML = submittedCount
        ? `<div class="list-item compact"><div><h4>${submittedCount} task${submittedCount === 1 ? "" : "s"} submitted</h4><span>Your progress is being saved for this classroom.</span></div></div>`
        : this.emptyState("No recent activity", "Your submissions and classroom check-ins will appear here.");
    }

    document.querySelectorAll("[data-submit-assignment]").forEach((button) => {
      button.addEventListener("click", async () => {
        await ClassroomAPI.submitAssignment(button.dataset.submitAssignment, student.id);
        const refreshed = (await ClassroomAPI.getStudentsByClassroom(classroomId)).find((item) => item.id === student.id);
        await this.renderStudentWorkspace(classroomId, refreshed);
      });
    });

    document.querySelectorAll("[data-open-spree-lesson], [data-complete-spree-lesson]").forEach((button) => {
      button.addEventListener("click", async () => {
        const isComplete = Boolean(button.dataset.completeSpreeLesson);
        const spreeItemId = button.dataset.completeSpreeLesson || button.dataset.openSpreeLesson;
        const now = new Date().toISOString();
        await ClassroomAPI.upsertSpreeItemProgress({
          assignmentId: button.dataset.spreeAssignment,
          spreeItemId,
          resourceId: button.dataset.spreeResource,
          studentId: student.id,
          classroomId: button.dataset.spreeClassroom || classroomId,
          status: isComplete ? "completed" : "opened",
          openedAt: now,
          completedAt: isComplete ? now : ""
        });
        const refreshed = (await ClassroomAPI.getStudentsByClassroom(classroomId)).find((item) => item.id === student.id) || student;
        await this.renderStudentWorkspace(classroomId, refreshed);
      });
    });
  }

  static getInviteLink(inviteCodeOrId) {
    if (window.App) {
      return `${window.location.origin}/join/${encodeURIComponent(inviteCodeOrId)}`;
    }

    const basePath = window.location.pathname.replace(/[^/]+$/, "join-classroom.html");
    return `${window.location.origin}${basePath}?classroomId=${encodeURIComponent(inviteCodeOrId)}`;
  }

  static showNotice(id, message, type = "success") {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.className = `notice ${type}`;
  }

  static showToast(message, type = "success") {
    if (window.UI?.showToast) {
      window.UI.showToast(message, type);
      return;
    }
    const toast = document.createElement("div");
    toast.className = `classroom-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.classList.add("is-visible"), 20);
    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 220);
    }, 2600);
    console.info(`[Digital Classroom] ${message}`);
  }
}

window.ClassroomUI = ClassroomUI;
