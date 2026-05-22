import { Auth } from "../assets/js/auth.js";
import { supabase } from "../assets/js/supabase.js";

const DIGITAL_CLASSROOM_BASE = "Digital_classroom/Digital%20Classroom";
const SCRIPT_BASE = `${DIGITAL_CLASSROOM_BASE}/assets/js`;
const PAGE_FILES = {
    dashboard: "teacher-dashboard.html",
    create: "create-classroom.html",
    detail: "classroom-detail.html",
    "activity-hub": "activity-hub.html",
    resources: "teacher-resources.html",
    "saved-collections": "saved-collections.html",
    student: "student-dashboard.html",
    join: "join-classroom.html",
    "my-classes": "my-classes.html"
};

let assetsPromise;

function ensureStylesheet() {
    const href = `${DIGITAL_CLASSROOM_BASE}/assets/css/classroom.css`;
    if (document.querySelector(`link[data-digital-classroom-css][href="${href}"]`)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.digitalClassroomCss = "true";
    document.head.appendChild(link);
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-digital-classroom-script][src="${src}"]`);
        if (existing?.dataset.loaded === "true") {
            resolve();
            return;
        }

        const script = existing || document.createElement("script");
        script.src = src;
        script.dataset.digitalClassroomScript = "true";
        script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load ${src}`));

        if (!existing) document.body.appendChild(script);
    });
}

function installSupabaseFacade() {
    window.DigitalClassroomSupabase = {
        getClient: () => supabase,
        getConfig: () => ({ source: "root-runtime" }),
        getStatus: () => ({
            configured: true,
            available: Boolean(supabase),
            libraryLoaded: Boolean(window.supabase?.createClient),
            source: "root-runtime",
            projectUrl: supabase?.supabaseUrl || null
        }),
        async getSession() {
            return Auth.getSession();
        },
        async getUser() {
            const session = await Auth.getSession();
            return session?.user || null;
        },
        async getProfile(userId) {
            if (!userId) return null;
            const { data, error } = await Auth.getProfile(userId);
            if (error) throw error;
            return data || null;
        }
    };
}

async function ensureAssets() {
    ensureStylesheet();
    installSupabaseFacade();

    if (!assetsPromise) {
        assetsPromise = (async () => {
            for (const src of [
                `${SCRIPT_BASE}/mock-data.js`,
                `${SCRIPT_BASE}/classroom-state.js`,
                `${SCRIPT_BASE}/classroom-api.js`,
                `${SCRIPT_BASE}/classroom-ui.js`
            ]) {
                await loadScript(src);
            }
        })();
    }

    await assetsPromise;
}

function routeToStandaloneHref(href) {
    if (!href || href.startsWith("#")) return null;

    const url = new URL(href, `${window.location.origin}/${DIGITAL_CLASSROOM_BASE}/`);
    const file = url.pathname.split("/").pop();
    const classroomId = url.searchParams.get("classroomId") || url.searchParams.get("id");

    if (file === "teacher-dashboard.html") return "#classroom";
    if (file === "create-classroom.html") return "#classroom/create";
    if (file === "classroom-detail.html" && classroomId) return `#classroom/detail/${encodeURIComponent(classroomId)}`;
    if (file === "activity-hub.html" && classroomId) return `#classroom/activity-hub/${encodeURIComponent(classroomId)}`;
    if (file === "teacher-resources.html") return "#classroom/resources";
    if (file === "saved-collections.html") {
        const classroomParam = classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : "";
        return `#classroom/saved-collections${classroomParam}`;
    }
    if (file === "student-dashboard.html" && classroomId) return `#classroom/student/${encodeURIComponent(classroomId)}`;
    if (file === "join-classroom.html" && classroomId) return `#classroom/join/${encodeURIComponent(classroomId)}`;
    return null;
}

function normalizeClassroomLinks(container) {
    container.querySelectorAll("a[href]").forEach((link) => {
        const mapped = routeToStandaloneHref(link.getAttribute("href"));
        if (mapped) link.setAttribute("href", mapped);
    });
}

async function loadPageMarkup(pageKey) {
    const file = PAGE_FILES[pageKey] || PAGE_FILES.dashboard;
    const response = await fetch(`${DIGITAL_CLASSROOM_BASE}/${file}`);
    if (!response.ok) throw new Error(`Failed to load Digital Classroom template: ${file}`);

    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const shell = parsed.body.querySelector("#app-shell") || parsed.body.querySelector("main");
    if (!shell) throw new Error(`Digital Classroom template is missing a mountable shell: ${file}`);

    shell.querySelectorAll("script").forEach((script) => script.remove());
    return {
        bodyPage: parsed.body.dataset.page || pageKey,
        studentPage: parsed.body.classList.contains("student-page"),
        markup: shell.outerHTML
    };
}

function readClassroomId(params) {
    const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
    const hashParams = new URLSearchParams(hashQuery);
    return params.id ||
        params.classroomId ||
        hashParams.get("classroomId") ||
        new URLSearchParams(window.location.search).get("classroomId");
}

export const DigitalClassroomPage = {
    _renderToken: null,

    async init(pageKey = "dashboard", params = {}) {
        const main = document.getElementById("main-content");
        if (!main) return;

        const renderToken = Symbol("digital-classroom-render");
        this._renderToken = renderToken;

        await ensureAssets();
        if (this._renderToken !== renderToken) return;

        const template = await loadPageMarkup(pageKey);
        if (this._renderToken !== renderToken) return;

        document.body.classList.add("digital-classroom-page");
        document.body.classList.toggle("student-page", template.studentPage);
        document.body.dataset.page = template.bodyPage;

        main.classList.remove("container");
        main.innerHTML = template.markup;
        normalizeClassroomLinks(main);

        const classroomId = readClassroomId(params);
        window.ClassroomState.init();

        const connectionStatus = await window.ClassroomAPI.getConnectionStatus?.();
        if (connectionStatus) {
            console.info("[Digital Classroom] Connection mode:", connectionStatus);
        }

        if (!["student", "join", "my-classes"].includes(pageKey)) {
            window.ClassroomUI.mountShell(template.bodyPage);
            normalizeClassroomLinks(main);
        }

        if (pageKey === "dashboard") {
            const authGate = await window.ClassroomAPI.getAuthGateState();
            if (this._renderToken !== renderToken) return;

            if (authGate.loginRequired) {
                window.ClassroomAPI.storeReturnUrl(window.location.href);
                window.ClassroomUI.renderTeacherLoginRequired();
                normalizeClassroomLinks(main);
                return;
            }
            await window.ClassroomUI.renderTeacherDashboard();
        }

        if (pageKey === "create") {
            await window.ClassroomUI.renderCreateClassroom();
        }

        if (pageKey === "detail") {
            await window.ClassroomUI.renderClassroomDetail(classroomId);
        }

        if (pageKey === "activity-hub") {
            await window.ClassroomUI.renderActivityHub(classroomId);
        }

        if (pageKey === "resources") {
            await window.ClassroomUI.renderTeachingResources(classroomId);
        }

        if (pageKey === "saved-collections") {
            await window.ClassroomUI.renderSavedCollections();
        }

        if (pageKey === "student") {
            await window.ClassroomUI.renderStudentDashboard(classroomId);
        }

        if (pageKey === "join") {
            await window.ClassroomUI.renderJoinClassroom(classroomId);
        }

        if (pageKey === "my-classes") {
            await window.ClassroomUI.renderMyClasses();
        }

        normalizeClassroomLinks(main);
    },

    cleanup() {
        document.body.classList.remove("digital-classroom-page", "student-page");
        delete document.body.dataset.page;
        document.getElementById("main-content")?.classList.add("container");
        this._renderToken = null;
    }
};
