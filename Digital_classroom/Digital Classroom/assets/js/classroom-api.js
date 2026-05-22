const ClassroomLocalStore = {
  getClassrooms() {
    return ClassroomState.getData().classrooms;
  },

  getClassroomById(id) {
    return ClassroomState.getData().classrooms.find((classroom) => classroom.id === id) || null;
  },

  createClassroom(classroomData) {
    return ClassroomState.update((data) => {
      const classroom = {
        id: ClassroomState.createId("class"),
        name: classroomData.name.trim(),
        subject: classroomData.subject.trim(),
        grade: classroomData.grade.trim(),
        description: classroomData.description.trim(),
        theme: classroomData.theme || "theme-blue",
        bucketItems: [],
        createdAt: new Date().toISOString()
      };

      data.classrooms.unshift(classroom);
      return classroom;
    });
  },

  getStudentsByClassroom(classroomId) {
    const data = ClassroomState.getData();
    return data.students
      .filter((student) => student.classroomId === classroomId)
      .map((student) => ({
        ...student,
        completedAssignments: data.submissions.filter((submission) => submission.studentId === student.id).length
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  },

  removeStudentFromClassroom(classroomId, studentId) {
    return ClassroomState.update((data) => {
      data.students = data.students.filter((student) => (
        student.classroomId !== classroomId ||
        ![student.id, student.profileId, student.memberId].filter(Boolean).includes(studentId)
      ));
      return { success: true };
    });
  },

  joinClassroom(classroomId, studentName) {
    return ClassroomState.update((data) => {
      const classroom = data.classrooms.find((item) => item.id === classroomId);
      if (!classroom) {
        throw new Error("Classroom not found.");
      }

      const normalizedName = studentName.trim();
      const existing = data.students.find(
        (student) => student.classroomId === classroomId && student.name.toLowerCase() === normalizedName.toLowerCase()
      );

      if (existing) {
        return existing;
      }

      const student = {
        id: ClassroomState.createId("stu"),
        classroomId,
        name: normalizedName,
        points: 0,
        avatar: normalizedName.charAt(0).toUpperCase(),
        joinedAt: new Date().toISOString()
      };

      data.students.push(student);
      return student;
    });
  },

  getAssignmentsByClassroom(classroomId) {
    return ClassroomState.getData()
      .assignments.filter((assignment) => assignment.classroomId === classroomId)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  },

  createAssignment(assignmentData) {
    return ClassroomState.update((data) => {
      const assignment = {
        id: ClassroomState.createId("ass"),
        classroomId: assignmentData.classroomId,
        title: assignmentData.title.trim(),
        instructions: assignmentData.instructions.trim(),
        dueDate: assignmentData.dueDate,
        points: Number(assignmentData.points),
        assignmentType: assignmentData.assignmentType || "assignment",
        resourceItems: Array.isArray(assignmentData.resourceItems) ? assignmentData.resourceItems : [],
        unlockMode: assignmentData.unlockMode || "open_access",
        startDate: assignmentData.startDate || "",
        timezone: assignmentData.timezone || "Asia/Colombo",
        status: assignmentData.status || "published",
        createdAt: new Date().toISOString()
      };

      data.assignments.unshift(assignment);
      return assignment;
    });
  },

  getSubmissionsByClassroom(classroomId) {
    return ClassroomState.getData().submissions.filter((submission) => submission.classroomId === classroomId);
  },

  getSubmission(assignmentId, studentId) {
    return (
      ClassroomState.getData().submissions.find(
        (submission) => submission.assignmentId === assignmentId && submission.studentId === studentId
      ) || null
    );
  },

  getSpreeItemProgress(assignmentId, studentId) {
    return ClassroomState.getData().spreeItemProgress.filter(
      (row) => row.assignmentId === assignmentId && row.studentId === studentId
    );
  },

  upsertSpreeItemProgress(progressData) {
    return ClassroomState.update((data) => {
      const now = new Date().toISOString();
      const existing = data.spreeItemProgress.find((row) => (
        row.assignmentId === progressData.assignmentId &&
        row.spreeItemId === progressData.spreeItemId &&
        row.studentId === progressData.studentId
      ));

      if (existing) {
        existing.status = progressData.status || existing.status;
        existing.openedAt = progressData.openedAt || existing.openedAt || "";
        existing.completedAt = progressData.completedAt || existing.completedAt || "";
        existing.updatedAt = now;
        return existing;
      }

      const row = {
        id: ClassroomState.createId("spree_prog"),
        assignmentId: progressData.assignmentId,
        spreeItemId: progressData.spreeItemId,
        resourceId: progressData.resourceId,
        studentId: progressData.studentId,
        classroomId: progressData.classroomId,
        status: progressData.status || "not_started",
        openedAt: progressData.openedAt || "",
        completedAt: progressData.completedAt || "",
        updatedAt: now,
        createdAt: now
      };
      data.spreeItemProgress.push(row);
      return row;
    });
  },

  submitAssignment(assignmentId, studentId) {
    return ClassroomState.update((data) => {
      const assignment = data.assignments.find((item) => item.id === assignmentId);
      const student = data.students.find((item) => item.id === studentId);

      if (!assignment || !student) {
        throw new Error("Assignment or student not found.");
      }

      const existing = data.submissions.find(
        (submission) => submission.assignmentId === assignmentId && submission.studentId === studentId
      );

      if (existing) {
        return existing;
      }

      const submission = {
        id: ClassroomState.createId("sub"),
        assignmentId,
        classroomId: assignment.classroomId,
        studentId,
        status: "submitted",
        pointsAwarded: Number(assignment.points) || 0,
        submittedAt: new Date().toISOString(),
        note: "Placeholder submission"
      };

      data.submissions.push(submission);
      student.points = Number(student.points || 0) + submission.pointsAwarded;
      return submission;
    });
  },

  getContentItems() {
    return ClassroomState.getData().contentItems;
  },

  addContentToClassroom(classroomId, contentId) {
    return ClassroomState.update((data) => {
      const classroom = data.classrooms.find((item) => item.id === classroomId);
      if (!classroom) {
        throw new Error("Classroom not found.");
      }

      classroom.bucketItems = Array.isArray(classroom.bucketItems) ? classroom.bucketItems : [];
      if (!classroom.bucketItems.includes(contentId)) {
        classroom.bucketItems.push(contentId);
      }

      return classroom;
    });
  },

  removeContentFromClassroom(classroomId, contentId) {
    return ClassroomState.update((data) => {
      const classroom = data.classrooms.find((item) => item.id === classroomId);
      if (!classroom) {
        throw new Error("Classroom not found.");
      }

      classroom.bucketItems = (classroom.bucketItems || []).filter((item) => item !== contentId);
      return classroom;
    });
  },

  getClassroomContent(classroomId) {
    const data = ClassroomState.getData();
    const classroom = data.classrooms.find((item) => item.id === classroomId);
    const bucketIds = classroom?.bucketItems || [];
    return data.contentItems.filter((item) => bucketIds.includes(item.id));
  },

  generateAiFeedback(classroomId) {
    return ClassroomState.update((data) => {
      const classroom = data.classrooms.find((item) => item.id === classroomId);
      if (!classroom) {
        throw new Error("Classroom not found.");
      }

      const students = data.students.filter((student) => student.classroomId === classroomId);
      const assignments = data.assignments.filter((assignment) => assignment.classroomId === classroomId);
      const submissions = data.submissions.filter((submission) => submission.classroomId === classroomId);
      const possibleSubmissions = Math.max(students.length * assignments.length, 1);
      const completionRate = Math.round((submissions.length / possibleSubmissions) * 100);
      const totalPoints = students.reduce((sum, student) => sum + Number(student.points || 0), 0);
      const averagePoints = students.length ? Math.round(totalPoints / students.length) : 0;

      const feedback = {
        id: ClassroomState.createId("ai"),
        classroomId,
        generatedAt: new Date().toISOString(),
        summary: `Mock AI feedback: ${classroom.name} has ${students.length} joined student(s), ${completionRate}% assignment completion, and an average of ${averagePoints} points.`,
        recommendations: [
          completionRate < 50
            ? "Send a reminder and consider breaking the next task into smaller checkpoints."
            : "Completion is moving well. Add one extension activity for high-scoring students.",
          students.length === 0
            ? "Share the WhatsApp invite link before assigning graded work."
            : "Review the leaderboard for students who may need encouragement.",
          assignments.length === 0
            ? "Create the first assignment to activate student progress tracking."
            : "Use bucket content as revision material before the next due date."
        ]
      };

      data.aiFeedbackLogs.unshift(feedback);
      return feedback;
    });
  },

  getLatestAiFeedback(classroomId) {
    return (
      ClassroomState.getData().aiFeedbackLogs.find((feedback) => feedback.classroomId === classroomId) || null
    );
  },

  getJoinedClassrooms() {
    const data = ClassroomState.getData();
    const joinedIds = new Set(data.students.map((student) => student.classroomId));
    return data.classrooms
      .filter((classroom) => joinedIds.has(classroom.id))
      .map((classroom) => ({
        ...classroom,
        teacherName: "Teacher",
        joinedAt: data.students.find((student) => student.classroomId === classroom.id)?.joinedAt || classroom.createdAt,
        taskCount: data.assignments.filter((assignment) => assignment.classroomId === classroom.id).length,
        unreadCount: 0
      }));
  },

  getStudentMembership(classroomId) {
    return null;
  },

  getClassroomInvite(inviteCodeOrId) {
    const classroom = this.getClassroomById(inviteCodeOrId) ||
      this.getClassrooms().find((item) => item.inviteCode === inviteCodeOrId);
    return classroom ? { classroom, alreadyJoined: false, membership: null, studentProfile: null } : null;
  },

  getStudentMembership(classroomId) {
    const studentId = sessionStorage.getItem(`edtechra_student_${classroomId}`);
    if (!studentId) return null;
    return this.getStudentsByClassroom(classroomId).find((student) => student.id === studentId) || null;
  },

  getTeacherDashboardData() {
    const classrooms = this.getClassrooms();
    const data = ClassroomState.getData();
    const studentIds = new Set();
    let totalAssignments = 0;
    let totalSubmissions = 0;
    const leaderboardRows = [];
    const assignmentRows = [];

    const enrichedClassrooms = classrooms.map((classroom) => {
      const students = this.getStudentsByClassroom(classroom.id);
      const assignments = this.getAssignmentsByClassroom(classroom.id);
      const submissions = this.getSubmissionsByClassroom(classroom.id);

      students.forEach((student) => {
        if (student.profileId || student.id) {
          studentIds.add(student.profileId || student.id);
        }
      });
      totalAssignments += assignments.length;
      totalSubmissions += submissions.length;
      leaderboardRows.push(...students.map((student) => ({ ...student, classroomName: classroom.name })));
      assignmentRows.push(...assignments.map((assignment) => ({ ...assignment, classroomName: classroom.name })));

      return {
        ...classroom,
        studentCount: students.length,
        assignmentCount: assignments.length
      };
    });

    return {
      source: "local",
      classrooms,
      enrichedClassrooms,
      contentItems: data.contentItems || [],
      leaderboardRows,
      assignmentRows,
      teacherProfile: null,
      stats: {
        classroomCount: classrooms.length,
        studentCount: studentIds.size,
        assignmentCount: totalAssignments,
        submissionCount: totalSubmissions
      }
    };
  }
};

const ClassroomSupabaseStore = {
  // TODO: The Creator Hub already owns public.submissions. Classroom work uses assignment_submissions instead.
  TABLES: {
    classrooms: "classrooms",
    classroomMembers: "classroom_members",
    classroomInvites: "classroom_invites",
    assignments: "assignments",
    assignmentSubmissions: "assignment_submissions",
    spreeItemProgress: "learning_spree_item_progress",
    submissions: "submissions",
    bookmarks: "bookmarks",
    contentBuckets: "content_buckets",
    bucketItems: "bucket_items",
    classroomPoints: "classroom_points",
    aiFeedbackLogs: "ai_feedback_logs"
  },

  featureCache: {},
  schemaCache: {},
  MODE_KEY: "edtechra_dc_mode",
  RETURN_URL_KEY: "edtechra_dc_return_url",
  DEBUG: true,

  debug(message, payload) {
    if (!this.DEBUG) return;
    if (payload === undefined) {
      console.info(`[Digital Classroom] ${message}`);
      return;
    }
    console.info(`[Digital Classroom] ${message}`, payload);
  },

  getConnectionStatus() {
    const status = window.DigitalClassroomSupabase?.getStatus?.() || {
      configured: false,
      available: false,
      reason: "Supabase client helper is not loaded."
    };
    return {
      ...status,
      selectedMode: this.getMode()
    };
  },

  getMode() {
    return sessionStorage.getItem(this.MODE_KEY) === "demo" ? "demo" : "supabase";
  },

  useDemoMode() {
    sessionStorage.setItem(this.MODE_KEY, "demo");
    this.debug("Selected mode", "demo");
  },

  useSupabaseMode() {
    sessionStorage.removeItem(this.MODE_KEY);
    this.debug("Selected mode", "supabase");
  },

  isDemoMode() {
    return this.getMode() === "demo";
  },

  storeReturnUrl(url = window.location.href) {
    localStorage.setItem(this.RETURN_URL_KEY, url);
  },

  getLoginUrl(returnUrl = window.location.href) {
    const configuredUrl = String(
      window.EDTECHRA_DC_ENV?.LOGIN_URL ||
      window.__DIGITAL_CLASSROOM_ENV__?.LOGIN_URL ||
      window.EDTECHRA_ENV?.LOGIN_URL ||
      window.__EDTECHRA_ENV__?.LOGIN_URL ||
      ""
    ).trim();

    if (configuredUrl) {
      const separator = configuredUrl.includes("?") ? "&" : "?";
      return `${configuredUrl}${separator}returnTo=${encodeURIComponent(returnUrl)}`;
    }

    return `${window.location.origin}/?returnTo=${encodeURIComponent(returnUrl)}#login`;
  },

  async getContext({ requireAuth = false } = {}) {
    if (this.isDemoMode()) {
      this.debug("Selected mode", "demo");
      return {
        enabled: false,
        fallbackAllowed: true,
        reason: "Demo mode selected."
      };
    }

    const status = this.getConnectionStatus();
    this.debug("Supabase connection state", status);
    if (!status.available) {
      this.debug("Fallback activation reason", status.reason || "Supabase is not configured.");
      return {
        enabled: false,
        fallbackAllowed: true,
        reason: status.reason || "Supabase is not configured."
      };
    }

    const client = window.DigitalClassroomSupabase.getClient();
    const user = await window.DigitalClassroomSupabase.getUser().catch(() => null);
    const profile = user
      ? await window.DigitalClassroomSupabase.getProfile(user.id).catch(() => null)
      : null;

    if (requireAuth && !user) {
      this.debug("Auth state", { authenticated: false, reason: "No active Edtechra session." });
      return {
        enabled: false,
        fallbackAllowed: false,
        reason: "No active Edtechra session."
      };
    }

    this.debug("Auth state", {
      authenticated: Boolean(user),
      userId: user?.id || null,
      role: profile?.role || null
    });

    return {
      enabled: true,
      client,
      user,
      profile,
      status
    };
  },

  shouldFallback(error) {
    const message = this.getErrorMessage(error).toLowerCase();
    const code = String(error?.code || "").toLowerCase();

    return (
      code === "42p01" ||
      code === "pgrst205" ||
      message.includes("does not exist") ||
      message.includes("could not find the table")
    );
  },

  getErrorMessage(error) {
    if (!error) return "Unknown Supabase error";
    return error.message || error.details || error.hint || String(error);
  },

  createUnavailableFeatureError(feature, error = null) {
    const table = this.TABLES[feature] || feature;
    const message = error
      ? `Supabase table "${table}" is unavailable: ${this.getErrorMessage(error)}`
      : `Supabase table "${table}" is unavailable.`;
    const nextError = new Error(message);
    nextError.code = "DIGITAL_CLASSROOM_SCHEMA_MISSING";
    nextError.feature = feature;
    nextError.table = table;
    nextError.cause = error || null;
    return nextError;
  },

  isSchemaMissingError(error) {
    return error?.code === "DIGITAL_CLASSROOM_SCHEMA_MISSING" || this.shouldFallback(error);
  },

  isRlsError(error) {
    const message = this.getErrorMessage(error).toLowerCase();
    const code = String(error?.code || "").toLowerCase();
    return code === "42501" || message.includes("row-level security") || message.includes("permission denied");
  },

  async withFallback(feature, remoteWork, localWork, options = {}) {
    const context = await this.getContext({ requireAuth: options.requireAuth });
    if (!context.enabled) {
      if (context.fallbackAllowed === false) {
        throw new Error(context.reason || "Supabase authentication is required.");
      }
      this.debug(`Using local fallback for ${feature}`, { reason: context.reason || "Supabase unavailable." });
      return localWork();
    }

    try {
      if (!(await this.isFeatureReady(context.client, feature))) {
        throw this.createUnavailableFeatureError(feature);
      }

      this.debug(`Running Supabase path for ${feature}`);
      return await remoteWork(context);
    } catch (error) {
      if (this.isSchemaMissingError(error)) {
        console.warn(`[Digital Classroom] Supabase schema issue for ${feature}. Local mock fallback was not used because Supabase is available.`, this.getErrorMessage(error));
        throw error;
      }

      if (this.isRlsError(error)) {
        console.warn(`[Digital Classroom] Supabase RLS/permission issue for ${feature}.`, this.getErrorMessage(error));
      }

      throw error;
    }
  },

  async isFeatureReady(client, feature) {
    if (this.featureCache[feature] !== undefined) {
      return this.featureCache[feature];
    }

    const table = this.TABLES[feature];
    if (!table) {
      this.featureCache[feature] = false;
      return false;
    }

    const { error } = await client.from(table).select("id").limit(1);
    if (error) {
      if (this.shouldFallback(error)) {
        this.featureCache[feature] = false;
        return false;
      }
      throw error;
    }

    this.featureCache[feature] = true;
    return true;
  },

  async assertFeaturesReady(client, features) {
    const missing = [];

    for (const feature of features) {
      if (!(await this.isFeatureReady(client, feature))) {
        missing.push(this.TABLES[feature] || feature);
      }
    }

    if (missing.length) {
      const error = new Error(`Missing Digital Classroom Supabase table(s): ${missing.join(", ")}`);
      error.code = "DIGITAL_CLASSROOM_SCHEMA_MISSING";
      error.tables = missing;
      throw error;
    }
  },

  async detectClassroomTitleColumn(client) {
    if (this.schemaCache.classroomTitleColumn) {
      return this.schemaCache.classroomTitleColumn;
    }

    const checks = [
      { column: "title", query: () => client.from(this.TABLES.classrooms).select("id, title").limit(1) },
      { column: "name", query: () => client.from(this.TABLES.classrooms).select("id, name").limit(1) }
    ];

    for (const check of checks) {
      const { error } = await check.query();
      if (!error) {
        this.schemaCache.classroomTitleColumn = check.column;
        this.debug("Detected classroom title column", check.column);
        return check.column;
      }

      if (!this.shouldFallback(error) && !String(error?.message || "").toLowerCase().includes("column")) {
        throw error;
      }
    }

    this.schemaCache.classroomTitleColumn = "title";
    return this.schemaCache.classroomTitleColumn;
  },

  async insertClassroomRow(client, payload) {
    const titleColumn = await this.detectClassroomTitleColumn(client);
    const insertPayload = {
      teacher_id: payload.teacher_id,
      subject: payload.subject,
      grade: payload.grade,
      description: payload.description,
      updated_at: new Date().toISOString()
    };

    insertPayload[titleColumn] = payload.title;

    let result = await client
      .from(this.TABLES.classrooms)
      .insert(insertPayload)
      .select("*")
      .single();

    if (!result.error) {
      return result;
    }

    const missingUpdatedAt = String(result.error?.message || "").toLowerCase().includes("updated_at");
    if (missingUpdatedAt) {
      const retryPayload = { ...insertPayload };
      delete retryPayload.updated_at;
      result = await client
        .from(this.TABLES.classrooms)
        .insert(retryPayload)
        .select("*")
        .single();
      if (!result.error) {
        return result;
      }
    }

    if (titleColumn === "title" && String(result.error?.message || "").toLowerCase().includes("title")) {
      this.schemaCache.classroomTitleColumn = "name";
      const legacyPayload = {
        teacher_id: payload.teacher_id,
        name: payload.title,
        subject: payload.subject,
        grade: payload.grade,
        description: payload.description
      };

      return client
        .from(this.TABLES.classrooms)
        .insert(legacyPayload)
        .select("*")
        .single();
    }

    return result;
  },

  normalizeClassroom(row) {
    return {
      id: row.id,
      name: row.title || row.name || "",
      subject: row.subject || "",
      grade: row.grade || row.grade_level || "",
      description: row.description || "",
      theme: row.theme || "theme-blue",
      inviteCode: row.invite_code || row.invite_token || row.id,
      teacherId: row.teacher_id || row.teacherId || null,
      teacherName: row.teacher_name || row.teacherName || "",
      bucketItems: [],
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || row.created_at || row.createdAt || new Date().toISOString()
    };
  },

  normalizeAssignment(row) {
    const metadata = this.parseAssignmentMetadata(row.instructions || "");
    const rawResourceItems = Array.isArray(row.resource_items)
      ? row.resource_items
      : Array.isArray(row.resourceItems)
        ? row.resourceItems
        : metadata.resourceItems || [];
    return {
      id: row.id,
      classroomId: row.classroom_id || row.classroomId,
      title: row.title || "",
      instructions: metadata.instructions || row.instructions || "",
      dueDate: row.due_date || row.dueDate || "",
      points: Number(row.points || 0),
      assignmentType: row.assignment_type || row.assignmentType || metadata.assignmentType || "assignment",
      resourceItems: rawResourceItems
        .map((item, index) => ({
          id: item.id || `${row.id || "assignment"}_${index + 1}`,
          resourceId: item.resource_id || item.resourceId || item.id || "",
          title: item.title_snapshot || item.title || "Saved material",
          resourceType: item.resource_type || item.resourceType || item.type || "saved work",
          savedAt: item.saved_at || item.savedAt || "",
          authorName: item.author_name || item.authorName || "",
          fileUrl: item.file_url || item.fileUrl || "",
          position: Number(item.position || index + 1)
        }))
        .sort((a, b) => a.position - b.position),
      unlockMode: row.unlock_mode || row.unlockMode || metadata.unlockMode || "open_access",
      startDate: row.start_date || row.startDate || metadata.startDate || "",
      timezone: row.timezone || metadata.timezone || "Asia/Colombo",
      status: row.status || row.assignmentStatus || "published",
      createdAt: row.created_at || row.createdAt || new Date().toISOString()
    };
  },

  parseAssignmentMetadata(instructions = "") {
    const start = "[EDTECHRA_LEARNING_SPREE]";
    const end = "[/EDTECHRA_LEARNING_SPREE]";
    const text = String(instructions || "");
    const startIndex = text.indexOf(start);
    const endIndex = text.indexOf(end);
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return { instructions: text };
    }

    const before = text.slice(0, startIndex).trim();
    const jsonText = text.slice(startIndex + start.length, endIndex).trim();
    try {
      const parsed = JSON.parse(jsonText);
      return {
        instructions: before,
        assignmentType: parsed.assignmentType || parsed.assignment_type,
        resourceItems: Array.isArray(parsed.resourceItems) ? parsed.resourceItems : [],
        unlockMode: parsed.unlockMode || parsed.unlock_mode,
        startDate: parsed.startDate || parsed.start_date,
        timezone: parsed.timezone
      };
    } catch (error) {
      console.warn("[Digital Classroom] Could not parse assignment metadata.", error);
      return { instructions: before || text };
    }
  },

  serializeAssignmentInstructions(assignmentData) {
    const instructions = String(assignmentData.instructions || "").trim();
    if (assignmentData.assignmentType !== "learning_spree") return instructions;

    const metadata = {
      assignmentType: "learning_spree",
      resourceItems: Array.isArray(assignmentData.resourceItems) ? assignmentData.resourceItems : [],
      unlockMode: assignmentData.unlockMode || "open_access",
      startDate: assignmentData.startDate || "",
      timezone: assignmentData.timezone || "Asia/Colombo"
    };
    return `${instructions}\n\n[EDTECHRA_LEARNING_SPREE]\n${JSON.stringify(metadata)}\n[/EDTECHRA_LEARNING_SPREE]`.trim();
  },

  normalizeTeachingResource(row) {
    const resourceType = row.resource_type || row.category || row.content_type || "resource";
    return {
      id: row.id,
      ownerId: row.owner_id || row.author_id || null,
      title: row.title || "Untitled resource",
      description: row.description || "",
      resourceType,
      category: row.category || resourceType,
      fileUrl: row.file_url || row.image_url || row.thumbnail_url || "",
      thumbnailUrl: row.thumbnail_url || row.image_url || "",
      visibility: row.visibility === "public" ? "public" : "private",
      status: row.status || "",
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString()
    };
  },

  normalizeSavedCollection(row, bookmark = {}) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const resourceType = row.resource_type || row.content_type || row.category || "saved work";
    return {
      id: row.id,
      ownerId: row.author_id || row.user_id || row.created_by || null,
      title: row.title || "Untitled saved work",
      description: row.description || "",
      resourceType,
      category: row.category || resourceType,
      fileUrl: row.file_url || row.image_url || row.thumbnail_url || "",
      thumbnailUrl: row.thumbnail_url || row.image_url || "",
      authorName: profile?.display_name || row.author_name || "Creator",
      status: row.status || "",
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      savedAt: bookmark.created_at || row.created_at || new Date().toISOString()
    };
  },

  buildFeedback(classroom, students, assignments, submissions) {
    const possibleSubmissions = Math.max(students.length * assignments.length, 1);
    const completionRate = Math.round((submissions.length / possibleSubmissions) * 100);
    const totalPoints = students.reduce((sum, student) => sum + Number(student.points || 0), 0);
    const averagePoints = students.length ? Math.round(totalPoints / students.length) : 0;

    return {
      id: ClassroomState.createId("ai"),
      classroomId: classroom.id,
      generatedAt: new Date().toISOString(),
      summary: `Mock AI feedback: ${classroom.name} has ${students.length} joined student(s), ${completionRate}% assignment completion, and an average of ${averagePoints} points.`,
      recommendations: [
        completionRate < 50
          ? "Send a reminder and consider breaking the next task into smaller checkpoints."
          : "Completion is moving well. Add one extension activity for high-scoring students.",
        students.length === 0
          ? "Share the WhatsApp invite link before assigning graded work."
          : "Review the leaderboard for students who may need encouragement.",
        assignments.length === 0
          ? "Create the first assignment to activate student progress tracking."
          : "Use bucket content as revision material before the next due date."
      ]
    };
  },

  async loadProfileMap(client, profileIds) {
    const ids = [...new Set((profileIds || []).filter(Boolean))];
    if (!ids.length) {
      return new Map();
    }

    const { data, error } = await client
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids);

    if (error) throw error;
    return new Map((data || []).map((row) => [row.id, row]));
  },

  async loadPointSummary(client, classroomId) {
    if (!(await this.isFeatureReady(client, "classroomPoints"))) {
      return new Map();
    }

    const { data, error } = await client
      .from(this.TABLES.classroomPoints)
      .select("profile_id, points")
      .eq("classroom_id", classroomId);

    if (error) throw error;

    const pointMap = new Map();
    (data || []).forEach((row) => {
      pointMap.set(row.profile_id, (pointMap.get(row.profile_id) || 0) + Number(row.points || 0));
    });
    return pointMap;
  },

  async loadPointSummaryForClassrooms(client, classroomIds) {
    if (!classroomIds.length || !(await this.isFeatureReady(client, "classroomPoints"))) {
      return new Map();
    }

    const { data, error } = await client
      .from(this.TABLES.classroomPoints)
      .select("classroom_id, profile_id, points")
      .in("classroom_id", classroomIds);

    if (error) throw error;

    const pointMap = new Map();
    (data || []).forEach((row) => {
      const key = `${row.classroom_id}:${row.profile_id}`;
      pointMap.set(key, (pointMap.get(key) || 0) + Number(row.points || 0));
    });
    return pointMap;
  },

  async loadSubmissionSummary(client, classroomId) {
    if (!(await this.isFeatureReady(client, "assignmentSubmissions"))) {
      return {
        submissionCount: 0,
        submissionByAssignmentAndStudent: new Map(),
        completedByStudent: new Map()
      };
    }

    const { data, error } = await client
      .from(this.TABLES.assignmentSubmissions)
      .select("id, assignment_id, student_id, classroom_id, status, points_awarded, submitted_at, note")
      .eq("classroom_id", classroomId);

    if (error) throw error;

    const submissionByAssignmentAndStudent = new Map();
    const completedByStudent = new Map();

    (data || []).forEach((row) => {
      submissionByAssignmentAndStudent.set(`${row.assignment_id}:${row.student_id}`, row);
      completedByStudent.set(row.student_id, (completedByStudent.get(row.student_id) || 0) + 1);
    });

    return {
      rows: data || [],
      submissionCount: (data || []).length,
      submissionByAssignmentAndStudent,
      completedByStudent
    };
  },

  async loadTeacherNameMap(client, teacherIds) {
    const ids = [...new Set((teacherIds || []).filter(Boolean))];
    if (!ids.length) return new Map();

    const { data, error } = await client
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);

    if (error) throw error;
    return new Map((data || []).map((row) => [row.id, row.display_name || "Teacher"]));
  },

  async ensureBucket(context, classroomId) {
    const { client, user, profile } = context;
    if (!(await this.isFeatureReady(client, "contentBuckets"))) {
      return null;
    }

    const { data: existing, error: existingError } = await client
      .from(this.TABLES.contentBuckets)
      .select("id, classroom_id, title")
      .eq("classroom_id", classroomId)
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    if (!user || profile?.role === "student") {
      return null;
    }

    const { data, error } = await client
      .from(this.TABLES.contentBuckets)
      .insert({
        classroom_id: classroomId,
        title: "Classroom Content",
        created_by: user.id
      })
      .select("id, classroom_id, title")
      .single();

    if (error) throw error;
    return data;
  }
};

const ClassroomAPI = {
  useDemoMode() {
    ClassroomSupabaseStore.useDemoMode();
  },

  useSupabaseMode() {
    ClassroomSupabaseStore.useSupabaseMode();
  },

  getSelectedMode() {
    return ClassroomSupabaseStore.getMode();
  },

  storeReturnUrl(url) {
    ClassroomSupabaseStore.storeReturnUrl(url);
  },

  getLoginUrl(returnUrl) {
    return ClassroomSupabaseStore.getLoginUrl(returnUrl);
  },

  async getAuthGateState() {
    const status = ClassroomSupabaseStore.getConnectionStatus();
    const session = status.available
      ? await window.DigitalClassroomSupabase.getSession().catch(() => null)
      : null;

    const state = {
      supabaseConfigured: Boolean(status.configured),
      supabaseAvailable: Boolean(status.available),
      sessionExists: Boolean(session),
      selectedMode: ClassroomSupabaseStore.getMode(),
      loginRequired: Boolean(status.configured && status.available && !session && !ClassroomSupabaseStore.isDemoMode()),
      status
    };

    console.info("[Digital Classroom] Auth gate", {
      supabaseConfigured: state.supabaseConfigured,
      sessionExists: state.sessionExists,
      selectedMode: state.selectedMode
    });

    return state;
  },

  async getConnectionStatus() {
    const status = ClassroomSupabaseStore.getConnectionStatus();
    const context = await ClassroomSupabaseStore.getContext({ requireAuth: false });

    return {
      ...status,
      authenticated: Boolean(context.user),
      profileId: context.profile?.id || null,
      role: context.profile?.role || null
    };
  },

  async getTeacherDashboardData() {
    const context = await ClassroomSupabaseStore.getContext({ requireAuth: true });
    if (!context.enabled) {
      if (context.fallbackAllowed === false) {
        throw new Error(context.reason || "Supabase authentication is required.");
      }
      ClassroomSupabaseStore.debug("Using local dashboard fallback", {
        reason: context.reason || "Supabase unavailable."
      });
      return ClassroomLocalStore.getTeacherDashboardData();
    }

    const requiredFeatures = [
      "classrooms",
      "classroomMembers",
      "assignments",
      "assignmentSubmissions"
    ];
    await ClassroomSupabaseStore.assertFeaturesReady(context.client, requiredFeatures);

    const { client, user, profile } = context;
    if (profile?.role && profile.role !== "teacher") {
      const error = new Error("Teacher role is required to load the Digital Classroom teacher dashboard.");
      error.code = "DIGITAL_CLASSROOM_TEACHER_REQUIRED";
      throw error;
    }

    ClassroomSupabaseStore.debug("Teacher dashboard fetch state", {
      teacherId: user.id,
      role: profile?.role || null
    });

    const { data: classroomRows, error: classroomError } = await client
      .from(ClassroomSupabaseStore.TABLES.classrooms)
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (classroomError) throw classroomError;

    const classrooms = (classroomRows || []).map((row) => ClassroomSupabaseStore.normalizeClassroom(row));
    const classroomIds = classrooms.map((classroom) => classroom.id);
    if (!classroomIds.length) {
      return {
        source: "supabase",
        classrooms,
        enrichedClassrooms: [],
        contentItems: [],
        leaderboardRows: [],
        assignmentRows: [],
        teacherProfile: profile || null,
        stats: {
          classroomCount: 0,
          studentCount: 0,
          assignmentCount: 0,
          submissionCount: 0
        }
      };
    }

    const [memberResult, assignmentResult, submissionResult, pointMap] = await Promise.all([
      client
        .from(ClassroomSupabaseStore.TABLES.classroomMembers)
        .select("id, classroom_id, profile_id, role, display_name, joined_at")
        .in("classroom_id", classroomIds),
      client
        .from(ClassroomSupabaseStore.TABLES.assignments)
        .select("*")
        .in("classroom_id", classroomIds)
        .order("due_date", { ascending: true }),
      client
        .from(ClassroomSupabaseStore.TABLES.assignmentSubmissions)
        .select("id, assignment_id, classroom_id, student_id, status, points_awarded, submitted_at, note")
        .in("classroom_id", classroomIds),
      ClassroomSupabaseStore.loadPointSummaryForClassrooms(client, classroomIds)
    ]);

    if (memberResult.error) throw memberResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    if (submissionResult.error) throw submissionResult.error;

    const memberRows = (memberResult.data || []).filter((row) => row.role !== "teacher");
    const assignmentRowsRaw = assignmentResult.data || [];
    const submissionRowsRaw = submissionResult.data || [];
    const uniqueStudentIds = new Set(memberRows.map((row) => row.profile_id).filter(Boolean));
    const profileMap = await ClassroomSupabaseStore.loadProfileMap(client, [...uniqueStudentIds]);

    const completedByClassroomAndStudent = new Map();
    submissionRowsRaw.forEach((row) => {
      const key = `${row.classroom_id}:${row.student_id}`;
      completedByClassroomAndStudent.set(key, (completedByClassroomAndStudent.get(key) || 0) + 1);
    });

    const studentsByClassroom = new Map();
    memberRows.forEach((row) => {
      const profile = profileMap.get(row.profile_id) || {};
      const name = row.display_name || profile.display_name || "Student";
      const pointsKey = `${row.classroom_id}:${row.profile_id}`;
      const completedKey = `${row.classroom_id}:${row.profile_id}`;
      const student = {
        id: row.profile_id || row.id,
        classroomId: row.classroom_id,
        memberId: row.id,
        profileId: row.profile_id,
        name,
        avatar: (name || "S").charAt(0).toUpperCase(),
        points: pointMap.get(pointsKey) || 0,
        completedAssignments: completedByClassroomAndStudent.get(completedKey) || 0,
        joinedAt: row.joined_at || new Date().toISOString()
      };

      if (!studentsByClassroom.has(row.classroom_id)) {
        studentsByClassroom.set(row.classroom_id, []);
      }
      studentsByClassroom.get(row.classroom_id).push(student);
    });

    const assignments = assignmentRowsRaw.map((row) => ClassroomSupabaseStore.normalizeAssignment(row));
    const assignmentsByClassroom = new Map();
    assignments.forEach((assignment) => {
      if (!assignmentsByClassroom.has(assignment.classroomId)) {
        assignmentsByClassroom.set(assignment.classroomId, []);
      }
      assignmentsByClassroom.get(assignment.classroomId).push(assignment);
    });

    const submissions = submissionRowsRaw.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      classroomId: row.classroom_id,
      studentId: row.student_id,
      status: row.status,
      pointsAwarded: Number(row.points_awarded || 0),
      submittedAt: row.submitted_at,
      note: row.note || ""
    }));
    const submissionsByClassroom = new Map();
    submissions.forEach((submission) => {
      if (!submissionsByClassroom.has(submission.classroomId)) {
        submissionsByClassroom.set(submission.classroomId, []);
      }
      submissionsByClassroom.get(submission.classroomId).push(submission);
    });

    const leaderboardRows = [];
    const assignmentRows = [];
    const enrichedClassrooms = classrooms.map((classroom) => {
      const students = (studentsByClassroom.get(classroom.id) || [])
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      const classroomAssignments = assignmentsByClassroom.get(classroom.id) || [];

      leaderboardRows.push(...students.map((student) => ({ ...student, classroomName: classroom.name })));
      assignmentRows.push(...classroomAssignments.map((assignment) => ({ ...assignment, classroomName: classroom.name })));

      return {
        ...classroom,
        studentCount: students.length,
        assignmentCount: classroomAssignments.length,
        submissionCount: (submissionsByClassroom.get(classroom.id) || []).length
      };
    });

    ClassroomSupabaseStore.debug("Teacher dashboard fetch success", {
      teacherId: user.id,
      classroomCount: classrooms.length,
      studentCount: uniqueStudentIds.size,
      assignmentCount: assignments.length,
      submissionCount: submissions.length
    });

    return {
      source: "supabase",
      classrooms,
      enrichedClassrooms,
      contentItems: [],
      leaderboardRows,
      assignmentRows,
      teacherProfile: profile || null,
      stats: {
        classroomCount: classrooms.length,
        studentCount: uniqueStudentIds.size,
        assignmentCount: assignments.length,
        submissionCount: submissions.length
      }
    };
  },

  async getClassrooms() {
    return ClassroomSupabaseStore.withFallback(
      "classrooms",
      async ({ client, user, profile }) => {
        ClassroomSupabaseStore.debug("Classroom fetch state", {
          teacherId: user.id,
          role: profile?.role || null
        });
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.classrooms)
          .select("*")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        ClassroomSupabaseStore.debug("Classroom fetch success", {
          teacherId: user.id,
          count: (data || []).length
        });
        return (data || []).map((row) => ClassroomSupabaseStore.normalizeClassroom(row));
      },
      () => ClassroomLocalStore.getClassrooms(),
      { requireAuth: true }
    );
  },

  async getClassroomById(id) {
    return ClassroomSupabaseStore.withFallback(
      "classrooms",
      async ({ client }) => {
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.classrooms)
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return data ? ClassroomSupabaseStore.normalizeClassroom(data) : null;
      },
      () => ClassroomLocalStore.getClassroomById(id),
      { requireAuth: true }
    );
  },

  async getCurrentStudentProfile() {
    const context = await ClassroomSupabaseStore.getContext({ requireAuth: true });
    if (!context.enabled) {
      if (context.fallbackAllowed === false) {
        throw new Error(context.reason || "Sign in to continue.");
      }
      return null;
    }

    return {
      id: context.user.id,
      email: context.user.email || "",
      displayName: context.profile?.display_name || context.user.email || "Student",
      role: context.profile?.role || context.user.user_metadata?.role || "student"
    };
  },

  async getStudentMembership(classroomId) {
    return ClassroomSupabaseStore.withFallback(
      "classroomMembers",
      async ({ client, user }) => {
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .select("id, classroom_id, profile_id, role, display_name, joined_at, last_accessed_at")
          .eq("classroom_id", classroomId)
          .eq("profile_id", user.id)
          .eq("role", "student")
          .maybeSingle();

        if (error) throw error;
        return data ? {
          id: data.profile_id || data.id,
          classroomId: data.classroom_id,
          memberId: data.id,
          profileId: data.profile_id,
          name: data.display_name || "Student",
          avatar: (data.display_name || "S").charAt(0).toUpperCase(),
          joinedAt: data.joined_at || new Date().toISOString()
        } : null;
      },
      () => ClassroomLocalStore.getStudentMembership(classroomId),
      { requireAuth: true }
    );
  },

  async getClassroomInvite(inviteCodeOrId) {
    const context = await ClassroomSupabaseStore.getContext({ requireAuth: true });
    if (!context.enabled) {
      if (context.fallbackAllowed === false) {
        throw new Error(context.reason || "Sign in to view this classroom invitation.");
      }
      return ClassroomLocalStore.getClassroomInvite(inviteCodeOrId);
    }

    const { client, user, profile } = context;
    const { data, error } = await client.rpc("get_classroom_invite", {
      invite_code_param: inviteCodeOrId
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    const classroom = ClassroomSupabaseStore.normalizeClassroom(row);
    const membership = await this.getStudentMembership(classroom.id).catch(() => null);
    return {
      classroom,
      alreadyJoined: Boolean(membership),
      membership,
      studentProfile: {
        id: user.id,
        email: user.email || "",
        displayName: profile?.display_name || user.email || "Student",
        role: profile?.role || user.user_metadata?.role || "student"
      }
    };
  },

  async getJoinedClassroomById(classroomId) {
    return ClassroomSupabaseStore.withFallback(
      "classroomMembers",
      async ({ client, user }) => {
        const { data: member, error: memberError } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .select("id, classroom_id, profile_id, role, display_name, joined_at, last_accessed_at")
          .eq("classroom_id", classroomId)
          .eq("profile_id", user.id)
          .eq("role", "student")
          .maybeSingle();

        if (memberError) throw memberError;
        if (!member) return null;

        const { data: classroomRow, error: classroomError } = await client
          .from(ClassroomSupabaseStore.TABLES.classrooms)
          .select("*")
          .eq("id", member.classroom_id)
          .maybeSingle();

        if (classroomError) throw classroomError;
        if (!classroomRow) return null;

        const classroom = ClassroomSupabaseStore.normalizeClassroom(classroomRow);
        const teacherMap = await ClassroomSupabaseStore.loadTeacherNameMap(client, [classroom.teacherId]).catch(() => new Map());
        const name = member.display_name || "Student";

        return {
          classroom: {
            ...classroom,
            teacherName: teacherMap.get(classroom.teacherId) || classroom.teacherName || "Teacher"
          },
          membership: {
            id: member.profile_id || member.id,
            classroomId: member.classroom_id,
            memberId: member.id,
            profileId: member.profile_id,
            name,
            avatar: name.charAt(0).toUpperCase(),
            joinedAt: member.joined_at || new Date().toISOString(),
            lastAccessedAt: member.last_accessed_at || null
          }
        };
      },
      () => {
        const classroom = ClassroomLocalStore.getClassroomById(classroomId);
        const membership = ClassroomLocalStore.getStudentMembership(classroomId);
        return classroom && membership ? { classroom, membership } : null;
      },
      { requireAuth: true }
    );
  },

  async touchStudentClassroomAccess(classroomId) {
    return ClassroomSupabaseStore.withFallback(
      "classroomMembers",
      async ({ client, user }) => {
        const { error } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .update({ last_accessed_at: new Date().toISOString() })
          .eq("classroom_id", classroomId)
          .eq("profile_id", user.id)
          .eq("role", "student");

        if (error) throw error;
        return { success: true };
      },
      () => ({ success: true }),
      { requireAuth: true }
    );
  },

  async createClassroom(classroomData) {
    return ClassroomSupabaseStore.withFallback(
      "classrooms",
      async ({ client, user, profile }) => {
        const payload = {
          teacher_id: user.id,
          title: classroomData.name.trim(),
          subject: classroomData.subject.trim(),
          grade: classroomData.grade.trim(),
          description: classroomData.description.trim()
        };
        ClassroomSupabaseStore.debug("Classroom insert state", payload);

        const { data, error } = await ClassroomSupabaseStore.insertClassroomRow(client, payload);

        if (error) throw error;
        ClassroomSupabaseStore.debug("Classroom insert success", {
          classroomId: data.id,
          teacherId: user.id
        });

        if (await ClassroomSupabaseStore.isFeatureReady(client, "classroomMembers")) {
          const { error: membershipError } = await client
            .from(ClassroomSupabaseStore.TABLES.classroomMembers)
            .upsert(
              {
                classroom_id: data.id,
                profile_id: user.id,
                role: "teacher",
                display_name: profile?.display_name || user.email || "Teacher"
              },
              { onConflict: "classroom_id,profile_id" }
            );

          if (membershipError && !ClassroomSupabaseStore.shouldFallback(membershipError)) {
            throw membershipError;
          }
        }

        return ClassroomSupabaseStore.normalizeClassroom(data);
      },
      () => ClassroomLocalStore.createClassroom(classroomData),
      { requireAuth: true }
    );
  },

  async getStudentsByClassroom(classroomId) {
    return ClassroomSupabaseStore.withFallback(
      "classroomMembers",
      async ({ client }) => {
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .select("id, classroom_id, profile_id, role, display_name, joined_at")
          .eq("classroom_id", classroomId);

        if (error) throw error;

        const studentRows = (data || []).filter((row) => row.role !== "teacher");
        const profileMap = await ClassroomSupabaseStore.loadProfileMap(
          client,
          studentRows.map((row) => row.profile_id)
        );
        const pointMap = await ClassroomSupabaseStore.loadPointSummary(client, classroomId);
        const submissionSummary = await ClassroomSupabaseStore.loadSubmissionSummary(client, classroomId);

        return studentRows
          .map((row) => {
            const profile = profileMap.get(row.profile_id) || {};
            const name = row.display_name || profile.display_name || "Student";
            return {
              id: row.profile_id || row.id,
              classroomId: row.classroom_id,
              memberId: row.id,
              profileId: row.profile_id,
              name,
              avatar: (name || "S").charAt(0).toUpperCase(),
              points: pointMap.get(row.profile_id) || 0,
              completedAssignments: submissionSummary.completedByStudent.get(row.profile_id) || 0,
              joinedAt: row.joined_at || new Date().toISOString()
            };
          })
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      },
      () => ClassroomLocalStore.getStudentsByClassroom(classroomId),
      { requireAuth: true }
    );
  },

  async removeStudentFromClassroom(classroomId, studentId) {
    return ClassroomSupabaseStore.withFallback(
      "classroomMembers",
      async ({ client }) => {
        const { data: member, error: memberError } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .select("id, profile_id, classroom_id, role")
          .eq("classroom_id", classroomId)
          .or(`id.eq.${studentId},profile_id.eq.${studentId}`)
          .neq("role", "teacher")
          .maybeSingle();

        if (memberError) throw memberError;
        if (!member) return { success: false };

        const { error } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .update({ status: "removed" })
          .eq("id", member.id);

        if (error) {
          const missingStatusColumn = String(ClassroomSupabaseStore.getErrorMessage(error)).toLowerCase().includes("status");
          if (!missingStatusColumn) throw error;

          const { error: deleteError } = await client
            .from(ClassroomSupabaseStore.TABLES.classroomMembers)
            .delete()
            .eq("id", member.id);

          if (deleteError) throw deleteError;
        }
        return { success: true };
      },
      () => ClassroomLocalStore.removeStudentFromClassroom(classroomId, studentId),
      { requireAuth: true }
    );
  },

  async joinClassroom(classroomId, studentName) {
    return ClassroomSupabaseStore.withFallback(
      "classroomMembers",
      async ({ client, user, profile }) => {
        if (!profile) {
          throw new Error("Your Edtechra profile could not be loaded. Please sign in again before joining this classroom.");
        }

        const { data: existing, error: existingError } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .select("id, classroom_id, profile_id, role, display_name, joined_at")
          .eq("classroom_id", classroomId)
          .eq("profile_id", user.id)
          .eq("role", "student")
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing) {
          const name = existing.display_name || profile?.display_name || studentName.trim();
          return {
            id: existing.profile_id || existing.id,
            classroomId: existing.classroom_id,
            memberId: existing.id,
            profileId: existing.profile_id,
            name,
            avatar: name.charAt(0).toUpperCase(),
            points: 0,
            completedAssignments: 0,
            joinedAt: existing.joined_at || new Date().toISOString(),
            alreadyEnrolled: true
          };
        }

        const normalizedName = studentName.trim();
        let { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .insert({
            classroom_id: classroomId,
            profile_id: user.id,
            role: "student",
            status: "active",
            display_name: normalizedName,
            last_accessed_at: new Date().toISOString()
          })
          .select("id, classroom_id, profile_id, role, display_name, joined_at")
          .single();

        if (error) {
          const missingStatusColumn = String(ClassroomSupabaseStore.getErrorMessage(error)).toLowerCase().includes("status");
          if (missingStatusColumn) {
            const retry = await client
              .from(ClassroomSupabaseStore.TABLES.classroomMembers)
              .insert({
                classroom_id: classroomId,
                profile_id: user.id,
                role: "student",
                display_name: normalizedName,
                last_accessed_at: new Date().toISOString()
              })
              .select("id, classroom_id, profile_id, role, display_name, joined_at")
              .single();
            data = retry.data;
            error = retry.error;
          }
        }

        if (error) {
          const isDuplicate = error.code === "23505" || /duplicate|unique/i.test(ClassroomSupabaseStore.getErrorMessage(error));
          if (isDuplicate) {
            return {
              id: user.id,
              classroomId,
              memberId: null,
              profileId: user.id,
              name: profile?.display_name || normalizedName,
              avatar: (profile?.display_name || normalizedName || "S").charAt(0).toUpperCase(),
              points: 0,
              completedAssignments: 0,
              joinedAt: new Date().toISOString(),
              alreadyEnrolled: true
            };
          }
          throw error;
        }

        return {
          id: data.profile_id || data.id,
          classroomId: data.classroom_id,
          memberId: data.id,
          profileId: data.profile_id,
          name: data.display_name || profile?.display_name || normalizedName,
          avatar: (data.display_name || profile?.display_name || normalizedName).charAt(0).toUpperCase(),
          points: 0,
          completedAssignments: 0,
          joinedAt: data.joined_at || new Date().toISOString(),
          alreadyEnrolled: false
        };
      },
      () => ClassroomLocalStore.joinClassroom(classroomId, studentName),
      { requireAuth: true }
    );
  },

  async getJoinedClassrooms() {
    return ClassroomSupabaseStore.withFallback(
      "classroomMembers",
      async ({ client, user }) => {
        const { data: memberRows, error: memberError } = await client
          .from(ClassroomSupabaseStore.TABLES.classroomMembers)
          .select("id, classroom_id, profile_id, role, display_name, joined_at, last_accessed_at")
          .eq("profile_id", user.id)
          .eq("role", "student")
          .order("last_accessed_at", { ascending: false, nullsFirst: false })
          .order("joined_at", { ascending: false });

        if (memberError) throw memberError;
        const classroomIds = [...new Set((memberRows || []).map((row) => row.classroom_id).filter(Boolean))];
        if (!classroomIds.length) return [];

        const { data: classroomRows, error: classroomError } = await client
          .from(ClassroomSupabaseStore.TABLES.classrooms)
          .select("*")
          .in("id", classroomIds);

        if (classroomError) throw classroomError;

        const classrooms = (classroomRows || []).map((row) => ClassroomSupabaseStore.normalizeClassroom(row));
        const teacherMap = await ClassroomSupabaseStore.loadTeacherNameMap(
          client,
          classrooms.map((classroom) => classroom.teacherId)
        ).catch(() => new Map());

        const assignmentsByClassroom = new Map();
        if (await ClassroomSupabaseStore.isFeatureReady(client, "assignments")) {
          const { data: assignments } = await client
            .from(ClassroomSupabaseStore.TABLES.assignments)
            .select("id, classroom_id, due_date")
            .in("classroom_id", classroomIds);
          (assignments || []).forEach((row) => {
            assignmentsByClassroom.set(row.classroom_id, (assignmentsByClassroom.get(row.classroom_id) || 0) + 1);
          });
        }

        const memberByClassroom = new Map((memberRows || []).map((row) => [row.classroom_id, row]));
        return classrooms.map((classroom) => {
          const member = memberByClassroom.get(classroom.id) || {};
          return {
            ...classroom,
            teacherName: teacherMap.get(classroom.teacherId) || classroom.teacherName || "Teacher",
            joinedAt: member.joined_at || classroom.createdAt,
            lastAccessedAt: member.last_accessed_at || null,
            taskCount: assignmentsByClassroom.get(classroom.id) || 0,
            unreadCount: 0
          };
        }).sort((a, b) => new Date(b.lastAccessedAt || b.joinedAt) - new Date(a.lastAccessedAt || a.joinedAt));
      },
      () => ClassroomLocalStore.getJoinedClassrooms(),
      { requireAuth: true }
    );
  },

  async getAssignmentsByClassroom(classroomId) {
    return ClassroomSupabaseStore.withFallback(
      "assignments",
      async ({ client }) => {
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.assignments)
          .select("*")
          .eq("classroom_id", classroomId)
          .order("due_date", { ascending: true });

        if (error) throw error;
        return (data || []).map((row) => ClassroomSupabaseStore.normalizeAssignment(row));
      },
      () => ClassroomLocalStore.getAssignmentsByClassroom(classroomId),
      { requireAuth: true }
    );
  },

  async createAssignment(assignmentData) {
    return ClassroomSupabaseStore.withFallback(
      "assignments",
      async ({ client, user }) => {
        const basePayload = {
          classroom_id: assignmentData.classroomId,
          created_by: user.id,
          title: assignmentData.title.trim(),
          instructions: assignmentData.instructions.trim(),
          due_date: assignmentData.dueDate,
          points: Number(assignmentData.points)
        };
        const isLearningSpree = assignmentData.assignmentType === "learning_spree";
        const extendedPayload = isLearningSpree
          ? {
            ...basePayload,
            assignment_type: "learning_spree",
            resource_items: assignmentData.resourceItems || [],
            unlock_mode: assignmentData.unlockMode || "open_access",
            start_date: assignmentData.startDate || null,
            timezone: assignmentData.timezone || "Asia/Colombo",
            status: assignmentData.status || "published"
          }
          : basePayload;

        let result = await client
          .from(ClassroomSupabaseStore.TABLES.assignments)
          .insert(extendedPayload)
          .select("*")
          .single();

        const missingExtendedColumns = result.error && (
          ["42703", "PGRST204"].includes(result.error.code) ||
          /assignment_type|resource_items|unlock_mode|start_date|timezone|status/i.test(`${result.error.message || ""} ${result.error.details || ""} ${result.error.hint || ""}`)
        );
        if (missingExtendedColumns && isLearningSpree) {
          result = await client
            .from(ClassroomSupabaseStore.TABLES.assignments)
            .insert({
              ...basePayload,
              instructions: ClassroomSupabaseStore.serializeAssignmentInstructions(assignmentData)
            })
            .select("*")
            .single();
        }

        if (result.error) throw result.error;
        return ClassroomSupabaseStore.normalizeAssignment(result.data);
      },
      () => ClassroomLocalStore.createAssignment(assignmentData),
      { requireAuth: true }
    );
  },

  async getSubmissionsByClassroom(classroomId) {
    return ClassroomSupabaseStore.withFallback(
      "assignmentSubmissions",
      async ({ client }) => {
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.assignmentSubmissions)
          .select("id, assignment_id, classroom_id, student_id, status, points_awarded, submitted_at, note")
          .eq("classroom_id", classroomId);

        if (error) throw error;

        return (data || []).map((row) => ({
          id: row.id,
          assignmentId: row.assignment_id,
          classroomId: row.classroom_id,
          studentId: row.student_id,
          status: row.status,
          pointsAwarded: Number(row.points_awarded || 0),
          submittedAt: row.submitted_at,
          note: row.note || ""
        }));
      },
      () => ClassroomLocalStore.getSubmissionsByClassroom(classroomId),
      { requireAuth: true }
    );
  },

  async getSubmission(assignmentId, studentId) {
    return ClassroomSupabaseStore.withFallback(
      "assignmentSubmissions",
      async ({ client }) => {
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.assignmentSubmissions)
          .select("id, assignment_id, classroom_id, student_id, status, points_awarded, submitted_at, note")
          .eq("assignment_id", assignmentId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
          id: data.id,
          assignmentId: data.assignment_id,
          classroomId: data.classroom_id,
          studentId: data.student_id,
          status: data.status,
          pointsAwarded: Number(data.points_awarded || 0),
          submittedAt: data.submitted_at,
          note: data.note || ""
        };
      },
      () => ClassroomLocalStore.getSubmission(assignmentId, studentId),
      { requireAuth: true }
    );
  },

  normalizeSpreeProgress(row) {
    return {
      id: row.id,
      assignmentId: row.assignment_id || row.assignmentId,
      spreeItemId: row.spree_item_id || row.spreeItemId,
      resourceId: row.resource_id || row.resourceId,
      studentId: row.student_id || row.studentId,
      classroomId: row.classroom_id || row.classroomId,
      status: row.status || "not_started",
      openedAt: row.opened_at || row.openedAt || "",
      completedAt: row.completed_at || row.completedAt || "",
      updatedAt: row.updated_at || row.updatedAt || "",
      createdAt: row.created_at || row.createdAt || ""
    };
  },

  async getSpreeItemProgress(assignmentId, studentId) {
    const context = await ClassroomSupabaseStore.getContext({ requireAuth: true });
    if (!context.enabled && context.fallbackAllowed === false) {
      throw new Error(context.reason || "Supabase authentication is required.");
    }
    if (!context.enabled || !(await ClassroomSupabaseStore.isFeatureReady(context.client, "spreeItemProgress"))) {
      return ClassroomLocalStore.getSpreeItemProgress(assignmentId, studentId);
    }

    const { data, error } = await context.client
      .from(ClassroomSupabaseStore.TABLES.spreeItemProgress)
      .select("*")
      .eq("assignment_id", assignmentId)
      .eq("student_id", studentId);

    if (error) throw error;
    return (data || []).map((row) => this.normalizeSpreeProgress(row));
  },

  async upsertSpreeItemProgress(progressData) {
    const now = new Date().toISOString();
    const context = await ClassroomSupabaseStore.getContext({ requireAuth: true });
    if (!context.enabled && context.fallbackAllowed === false) {
      throw new Error(context.reason || "Supabase authentication is required.");
    }
    if (!context.enabled || !(await ClassroomSupabaseStore.isFeatureReady(context.client, "spreeItemProgress"))) {
      return ClassroomLocalStore.upsertSpreeItemProgress(progressData);
    }

    const payload = {
      assignment_id: progressData.assignmentId,
      spree_item_id: progressData.spreeItemId,
      resource_id: progressData.resourceId,
      student_id: progressData.studentId,
      classroom_id: progressData.classroomId,
      status: progressData.status || "not_started",
      opened_at: progressData.openedAt || null,
      completed_at: progressData.completedAt || null,
      updated_at: now
    };

    const { data, error } = await context.client
      .from(ClassroomSupabaseStore.TABLES.spreeItemProgress)
      .upsert(payload, { onConflict: "assignment_id,spree_item_id,student_id" })
      .select("*")
      .single();

    if (error) throw error;
    return this.normalizeSpreeProgress(data);
  },

  async submitAssignment(assignmentId, studentId) {
    return ClassroomSupabaseStore.withFallback(
      "assignmentSubmissions",
      async ({ client, user }) => {
        if (!user || user.id !== studentId) {
          throw new Error("No active Edtechra session.");
        }

        const { data: assignmentRow, error: assignmentError } = await client
          .from(ClassroomSupabaseStore.TABLES.assignments)
          .select("id, classroom_id, points")
          .eq("id", assignmentId)
          .single();

        if (assignmentError) throw assignmentError;

        const { data: existing, error: existingError } = await client
          .from(ClassroomSupabaseStore.TABLES.assignmentSubmissions)
          .select("id, assignment_id, classroom_id, student_id, status, points_awarded, submitted_at, note")
          .eq("assignment_id", assignmentId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing) {
          return {
            id: existing.id,
            assignmentId: existing.assignment_id,
            classroomId: existing.classroom_id,
            studentId: existing.student_id,
            status: existing.status,
            pointsAwarded: Number(existing.points_awarded || 0),
            submittedAt: existing.submitted_at,
            note: existing.note || ""
          };
        }

        const submissionPayload = {
          assignment_id: assignmentId,
          classroom_id: assignmentRow.classroom_id,
          student_id: studentId,
          status: "submitted",
          note: "Placeholder submission",
          points_awarded: Number(assignmentRow.points || 0)
        };

        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.assignmentSubmissions)
          .insert(submissionPayload)
          .select("id, assignment_id, classroom_id, student_id, status, points_awarded, submitted_at, note")
          .single();

        if (error) throw error;

        if (await ClassroomSupabaseStore.isFeatureReady(client, "classroomPoints")) {
          const { error: pointsError } = await client
            .from(ClassroomSupabaseStore.TABLES.classroomPoints)
            .insert({
              classroom_id: assignmentRow.classroom_id,
              profile_id: studentId,
              assignment_submission_id: data.id,
              points: Number(assignmentRow.points || 0),
              reason: "Assignment submission"
            });

          if (pointsError && !ClassroomSupabaseStore.shouldFallback(pointsError)) {
            throw pointsError;
          }
        }

        return {
          id: data.id,
          assignmentId: data.assignment_id,
          classroomId: data.classroom_id,
          studentId: data.student_id,
          status: data.status,
          pointsAwarded: Number(data.points_awarded || 0),
          submittedAt: data.submitted_at,
          note: data.note || ""
        };
      },
      () => ClassroomLocalStore.submitAssignment(assignmentId, studentId),
      { requireAuth: true }
    );
  },

  async getContentItems() {
    return ClassroomLocalStore.getContentItems();
  },

  async getTeachingResources(classroomId = "") {
    return ClassroomSupabaseStore.withFallback(
      "submissions",
      async ({ client, user }) => {
        if (!user?.id) return [];

        let query = client
          .from(ClassroomSupabaseStore.TABLES.submissions)
          .select(`
            id,
            author_id,
            owner_id,
            owner_role,
            teacher_id,
            upload_context,
            source,
            classroom_id,
            resource_purpose,
            title,
            description,
            category,
            content_type,
            resource_type,
            file_url,
            thumbnail_url,
            image_url,
            visibility,
            status,
            created_at,
            updated_at
          `)
          .eq("owner_id", user.id)
          .eq("author_id", user.id)
          .eq("teacher_id", user.id)
          .eq("owner_role", "teacher")
          .eq("resource_purpose", "teaching_resource")
          .eq("upload_context", "classroom")
          .eq("source", "digital_classroom");

        if (classroomId) {
          query = query.eq("classroom_id", classroomId);
        }

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) {
          if (ClassroomSupabaseStore.shouldFallback(error) || String(error?.message || "").toLowerCase().includes("column")) {
            console.warn(
              "[Digital Classroom] My Teaching Resources requires classroom upload metadata columns. Returning an empty resource list to avoid showing global uploads.",
              ClassroomSupabaseStore.getErrorMessage(error)
            );
            return [];
          }
          throw error;
        }

        return (data || [])
          .filter((row) => (
            row.author_id === user.id &&
            row.teacher_id === user.id &&
            row.owner_id === user.id &&
            row.owner_role === "teacher" &&
            row.resource_purpose === "teaching_resource" &&
            row.upload_context === "classroom" &&
            row.source === "digital_classroom" &&
            (!classroomId || row.classroom_id === classroomId)
          ))
          .map((row) => ClassroomSupabaseStore.normalizeTeachingResource(row));
      },
      () => [],
      { requireAuth: true }
    );
  },

  async getSavedCollections() {
    return ClassroomSupabaseStore.withFallback(
      "bookmarks",
      async ({ client, user }) => {
        if (!user?.id) return [];

        const { data: bookmarks, error: bookmarkError } = await client
          .from(ClassroomSupabaseStore.TABLES.bookmarks)
          .select("id, submission_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (bookmarkError) throw bookmarkError;
        if (!bookmarks?.length) return [];

        const bookmarkBySubmissionId = new Map(bookmarks.map((bookmark) => [String(bookmark.submission_id), bookmark]));
        const submissionIds = bookmarks.map((bookmark) => bookmark.submission_id).filter(Boolean);
        if (!submissionIds.length) return [];

        const { data: submissions, error: submissionError } = await client
          .from(ClassroomSupabaseStore.TABLES.submissions)
          .select(`
            id,
            title,
            description,
            category,
            content_type,
            author_id,
            thumbnail_path,
            thumbnail_url,
            image_url,
            file_url,
            status,
            created_at,
            updated_at,
            profiles!author_id(display_name)
          `)
          .in("id", submissionIds);

        if (submissionError) throw submissionError;

        const submissionById = new Map((submissions || []).map((submission) => [String(submission.id), submission]));
        return submissionIds
          .map((submissionId) => {
            const submission = submissionById.get(String(submissionId));
            if (!submission) return null;
            return ClassroomSupabaseStore.normalizeSavedCollection(
              submission,
              bookmarkBySubmissionId.get(String(submissionId))
            );
          })
          .filter(Boolean);
      },
      () => [],
      { requireAuth: true }
    );
  },

  async addContentToClassroom(classroomId, contentId) {
    return ClassroomSupabaseStore.withFallback(
      "bucketItems",
      async (context) => {
        if (!(await ClassroomSupabaseStore.isFeatureReady(context.client, "contentBuckets"))) {
          return ClassroomLocalStore.addContentToClassroom(classroomId, contentId);
        }

        const bucket = await ClassroomSupabaseStore.ensureBucket(context, classroomId);
        if (!bucket) {
          return ClassroomLocalStore.addContentToClassroom(classroomId, contentId);
        }

        const { data: existing, error: existingError } = await context.client
          .from(ClassroomSupabaseStore.TABLES.bucketItems)
          .select("id")
          .eq("bucket_id", bucket.id)
          .eq("content_id", contentId)
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing) return existing;

        const contentItem = ClassroomLocalStore.getContentItems().find((item) => item.id === contentId);
        const { data, error } = await context.client
          .from(ClassroomSupabaseStore.TABLES.bucketItems)
          .insert({
            bucket_id: bucket.id,
            content_id: contentId,
            title: contentItem?.title || contentId,
            item_type: contentItem?.type || null,
            subject: contentItem?.subject || null,
            grade_level: contentItem?.level || null,
            minutes: contentItem?.minutes || null
          })
          .select("id")
          .single();

        if (error) throw error;
        return data;
      },
      () => ClassroomLocalStore.addContentToClassroom(classroomId, contentId),
      { requireAuth: true }
    );
  },

  async removeContentFromClassroom(classroomId, contentId) {
    return ClassroomSupabaseStore.withFallback(
      "bucketItems",
      async (context) => {
        const bucket = await ClassroomSupabaseStore.ensureBucket(context, classroomId);
        if (!bucket) {
          return ClassroomLocalStore.removeContentFromClassroom(classroomId, contentId);
        }

        const { error } = await context.client
          .from(ClassroomSupabaseStore.TABLES.bucketItems)
          .delete()
          .eq("bucket_id", bucket.id)
          .eq("content_id", contentId);

        if (error) throw error;
        return { success: true };
      },
      () => ClassroomLocalStore.removeContentFromClassroom(classroomId, contentId),
      { requireAuth: true }
    );
  },

  async getClassroomContent(classroomId) {
    return ClassroomSupabaseStore.withFallback(
      "bucketItems",
      async (context) => {
        const bucket = await ClassroomSupabaseStore.ensureBucket(context, classroomId);
        if (!bucket) {
          return [];
        }

        const { data, error } = await context.client
          .from(ClassroomSupabaseStore.TABLES.bucketItems)
          .select("content_id, title, item_type, subject, grade_level, minutes")
          .eq("bucket_id", bucket.id)
          .order("created_at", { ascending: true });

        if (error) throw error;

        return (data || []).map((row) => ({
          id: row.content_id,
          title: row.title,
          type: row.item_type || "Content",
          subject: row.subject || "",
          level: row.grade_level || "",
          minutes: Number(row.minutes || 0)
        }));
      },
      () => ClassroomLocalStore.getClassroomContent(classroomId),
      { requireAuth: true }
    );
  },

  async generateAiFeedback(classroomId) {
    const classroom = await this.getClassroomById(classroomId);
    if (!classroom) {
      throw new Error("Classroom not found.");
    }

    const [students, assignments, submissions] = await Promise.all([
      this.getStudentsByClassroom(classroomId),
      this.getAssignmentsByClassroom(classroomId),
      this.getSubmissionsByClassroom(classroomId)
    ]);
    const feedback = ClassroomSupabaseStore.buildFeedback(classroom, students, assignments, submissions);

    return ClassroomSupabaseStore.withFallback(
      "aiFeedbackLogs",
      async ({ client, user }) => {
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.aiFeedbackLogs)
          .insert({
            classroom_id: classroomId,
            created_by: user.id,
            summary: feedback.summary,
            payload: {
              recommendations: feedback.recommendations,
              generatedAt: feedback.generatedAt,
              source: "mock"
            }
          })
          .select("id, classroom_id, created_at, summary, payload")
          .single();

        if (error) throw error;

        return {
          id: data.id,
          classroomId: data.classroom_id,
          generatedAt: data.created_at,
          summary: data.summary,
          recommendations: Array.isArray(data.payload?.recommendations) ? data.payload.recommendations : feedback.recommendations
        };
      },
      () => ClassroomLocalStore.generateAiFeedback(classroomId),
      { requireAuth: true }
    );
  },

  async getLatestAiFeedback(classroomId) {
    return ClassroomSupabaseStore.withFallback(
      "aiFeedbackLogs",
      async ({ client }) => {
        const { data, error } = await client
          .from(ClassroomSupabaseStore.TABLES.aiFeedbackLogs)
          .select("id, classroom_id, created_at, summary, payload")
          .eq("classroom_id", classroomId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
          id: data.id,
          classroomId: data.classroom_id,
          generatedAt: data.created_at,
          summary: data.summary,
          recommendations: Array.isArray(data.payload?.recommendations) ? data.payload.recommendations : []
        };
      },
      () => ClassroomLocalStore.getLatestAiFeedback(classroomId),
      { requireAuth: true }
    );
  },

  async getClassroomMetrics(classroomId) {
    const [students, assignments, submissions] = await Promise.all([
      this.getStudentsByClassroom(classroomId),
      this.getAssignmentsByClassroom(classroomId),
      this.getSubmissionsByClassroom(classroomId)
    ]);
    const possibleSubmissions = Math.max(students.length * assignments.length, 1);
    const totalPoints = students.reduce((sum, student) => sum + Number(student.points || 0), 0);

    return {
      studentCount: students.length,
      assignmentCount: assignments.length,
      submissionCount: submissions.length,
      completionRate: Math.round((submissions.length / possibleSubmissions) * 100),
      classAverage: students.length ? Math.round(totalPoints / students.length) : 0,
      activeStudents: students.filter((student) =>
        submissions.some((submission) => submission.studentId === student.id)
      ).length,
      totalPoints
    };
  }
};

window.ClassroomAPI = ClassroomAPI;
