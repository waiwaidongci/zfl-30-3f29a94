const ProjectManager = (() => {
  const PROJECTS_KEY = "zfl30_projects";
  const CURRENT_PROJECT_KEY = "zfl30_currentProject";
  const OLD_KEYS = {
    marks: "zfl30Marks",
    dives: "zfl30Dives",
    measurements: "zfl30Measurements",
    scale: "zfl30Scale",
    grid: "zfl30Grid",
    importErrors: "zfl30ImportErrors",
    baseMap: "zfl30BaseMap",
  };

  const DEFAULT_PROJECT_NAME = "默认遗址";

  function generateId() {
    return crypto.randomUUID();
  }

  function projKey(projectId, suffix) {
    return "zfl30_proj_" + projectId + "_" + suffix;
  }

  function loadProjects() {
    try {
      return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveProjects(projects) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  function loadCurrentProjectId() {
    return localStorage.getItem(CURRENT_PROJECT_KEY) || null;
  }

  function saveCurrentProjectId(id) {
    if (id) {
      localStorage.setItem(CURRENT_PROJECT_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
  }

  function hasOldData() {
    return (
      localStorage.getItem(OLD_KEYS.marks) !== null ||
      localStorage.getItem(OLD_KEYS.dives) !== null
    );
  }

  function migrateOldData() {
    if (!hasOldData()) return null;

    const projects = loadProjects();
    if (projects.length > 0) return null;

    const projectId = generateId();
    const now = new Date().toISOString();

    const project = {
      id: projectId,
      name: DEFAULT_PROJECT_NAME,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    const marksRaw = localStorage.getItem(OLD_KEYS.marks);
    const divesRaw = localStorage.getItem(OLD_KEYS.dives);
    const measurementsRaw = localStorage.getItem(OLD_KEYS.measurements);
    const scaleRaw = localStorage.getItem(OLD_KEYS.scale);
    const gridRaw = localStorage.getItem(OLD_KEYS.grid);
    const importErrorsRaw = localStorage.getItem(OLD_KEYS.importErrors);
    const baseMapRaw = localStorage.getItem(OLD_KEYS.baseMap);

    if (marksRaw) {
      localStorage.setItem(projKey(projectId, "marks"), marksRaw);
    }
    if (divesRaw) {
      localStorage.setItem(projKey(projectId, "dives"), divesRaw);
    }
    if (measurementsRaw) {
      localStorage.setItem(projKey(projectId, "measurements"), measurementsRaw);
    }
    if (scaleRaw) {
      localStorage.setItem(projKey(projectId, "scale"), scaleRaw);
    }
    if (gridRaw) {
      localStorage.setItem(projKey(projectId, "grid"), gridRaw);
    }
    if (importErrorsRaw) {
      localStorage.setItem(projKey(projectId, "importErrors"), importErrorsRaw);
    }
    if (baseMapRaw) {
      localStorage.setItem(projKey(projectId, "baseMap"), baseMapRaw);
    }

    projects.push(project);
    saveProjects(projects);
    saveCurrentProjectId(projectId);

    Object.values(OLD_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });

    return project;
  }

  function ensureDefaultProject() {
    let projects = loadProjects();
    if (projects.length === 0) {
      const projectId = generateId();
      const now = new Date().toISOString();
      const project = {
        id: projectId,
        name: DEFAULT_PROJECT_NAME,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      projects.push(project);
      saveProjects(projects);
      saveCurrentProjectId(projectId);
      return project;
    }
    return null;
  }

  function init() {
    const migrated = migrateOldData();
    if (!migrated) {
      ensureDefaultProject();
    }

    let currentId = loadCurrentProjectId();
    const projects = loadProjects();

    if (!currentId || !projects.find((p) => p.id === currentId)) {
      const active = projects.find((p) => !p.archived) || projects[0];
      if (active) {
        saveCurrentProjectId(active.id);
        currentId = active.id;
      }
    }

    return getCurrentProject();
  }

  function getCurrentProject() {
    const currentId = loadCurrentProjectId();
    if (!currentId) return null;
    const projects = loadProjects();
    return projects.find((p) => p.id === currentId) || null;
  }

  function getActiveProjects() {
    return loadProjects().filter((p) => !p.archived);
  }

  function getAllProjects() {
    return loadProjects();
  }

  function createProject(name) {
    const projects = loadProjects();
    const now = new Date().toISOString();
    const project = {
      id: generateId(),
      name: name.trim() || "未命名遗址",
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    projects.push(project);
    saveProjects(projects);
    return project;
  }

  function renameProject(projectId, newName) {
    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return false;
    project.name = newName.trim() || "未命名遗址";
    project.updatedAt = new Date().toISOString();
    saveProjects(projects);
    return true;
  }

  function archiveProject(projectId) {
    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return false;

    const activeProjects = projects.filter((p) => !p.archived && p.id !== projectId);
    if (activeProjects.length === 0) {
      return false;
    }

    project.archived = true;
    project.updatedAt = new Date().toISOString();
    saveProjects(projects);

    const currentId = loadCurrentProjectId();
    if (currentId === projectId) {
      const next = projects.find((p) => !p.archived && p.id !== projectId);
      if (next) {
        saveCurrentProjectId(next.id);
        return next.id;
      }
    }
    return null;
  }

  function unarchiveProject(projectId) {
    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return false;
    project.archived = false;
    project.updatedAt = new Date().toISOString();
    saveProjects(projects);
    return true;
  }

  function deleteProject(projectId) {
    const projects = loadProjects();
    if (projects.length <= 1) return false;

    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return false;

    ["marks", "dives", "measurements", "scale", "grid", "importErrors", "baseMap"].forEach((suffix) => {
      localStorage.removeItem(projKey(projectId, suffix));
    });

    projects.splice(idx, 1);
    saveProjects(projects);

    const currentId = loadCurrentProjectId();
    if (currentId === projectId) {
      const next = projects.find((p) => !p.archived) || projects[0];
      if (next) {
        saveCurrentProjectId(next.id);
        return next.id;
      }
    }
    return null;
  }

  function switchProject(projectId) {
    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return false;
    saveCurrentProjectId(projectId);
    return true;
  }

  function loadProjectData(projectId, suffix) {
    try {
      return JSON.parse(localStorage.getItem(projKey(projectId, suffix)) || (suffix === "scale" || suffix === "grid" ? "null" : "[]"));
    } catch (e) {
      return suffix === "scale" || suffix === "grid" ? null : [];
    }
  }

  function saveProjectData(projectId, suffix, data) {
    localStorage.setItem(projKey(projectId, suffix), JSON.stringify(data));
  }

  function getProjectStorageUsage(projectId) {
    let totalSize = 0;
    ["marks", "dives", "measurements", "scale", "grid", "importErrors", "baseMap"].forEach((suffix) => {
      const value = localStorage.getItem(projKey(projectId, suffix));
      if (value) {
        totalSize += new Blob([value]).size;
      }
    });
    return totalSize;
  }

  return {
    init,
    getCurrentProject,
    getActiveProjects,
    getAllProjects,
    createProject,
    renameProject,
    archiveProject,
    unarchiveProject,
    deleteProject,
    switchProject,
    loadProjectData,
    saveProjectData,
    getProjectStorageUsage,
    projKey,
  };
})();
