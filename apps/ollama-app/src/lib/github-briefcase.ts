// GitHub integration for Karen86Tonoyan/briefcase repo

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = 'Karen86Tonoyan';
const REPO_NAME = 'briefcase';

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface GitHubTemplate {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
  children?: GitHubTemplate[];
}

export interface ClonedTemplate {
  name: string;
  files: { path: string; content: string; language: string }[];
}

// Fetch recent commits from the Briefcase fork
export async function fetchRepoCommits(limit = 15): Promise<GitHubCommit[]> {
  try {
    const resp = await fetch(
      `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=${limit}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.map((c: any) => ({
      sha: c.sha?.slice(0, 7) || '',
      message: c.commit?.message?.split('\n')[0] || '',
      author: c.commit?.author?.name || 'unknown',
      date: c.commit?.author?.date || '',
      url: c.html_url || '',
    }));
  } catch {
    return [];
  }
}

// Fetch repo info (stars, forks, last push)
export async function fetchRepoInfo(): Promise<{
  stars: number;
  forks: number;
  lastPush: string;
  description: string;
  defaultBranch: string;
} | null> {
  try {
    const resp = await fetch(
      `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      lastPush: data.pushed_at || '',
      description: data.description || '',
      defaultBranch: data.default_branch || 'main',
    };
  } catch {
    return null;
  }
}

// Fetch templates directory from repo
export async function fetchRepoTemplates(): Promise<GitHubTemplate[]> {
  const paths = [
    'src/briefcase/commands',
    'src/briefcase/platforms',
  ];
  const results: GitHubTemplate[] = [];

  for (const path of paths) {
    try {
      const resp = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      if (Array.isArray(data)) {
        results.push(
          ...data.map((item: any) => ({
            name: item.name,
            path: item.path,
            type: item.type === 'dir' ? 'dir' as const : 'file' as const,
            download_url: item.download_url || null,
          }))
        );
      }
    } catch {
      // skip
    }
  }
  return results;
}

// Fetch file content from repo
export async function fetchRepoFile(path: string): Promise<string | null> {
  try {
    const resp = await fetch(
      `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      {
        headers: { Accept: 'application/vnd.github.raw' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!resp.ok) return null;
    return resp.text();
  } catch {
    return null;
  }
}

// Recursively fetch all files from a directory in repo
export async function fetchDirContents(dirPath: string): Promise<{ path: string; content: string; language: string }[]> {
  const files: { path: string; content: string; language: string }[] = [];
  try {
    const resp = await fetch(
      `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${dirPath}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) return files;
    const items = await resp.json();
    if (!Array.isArray(items)) return files;

    const fileItems = items.filter((i: any) => i.type === 'file' && i.name.endsWith('.py'));
    const dirItems = items.filter((i: any) => i.type === 'dir');

    // Fetch file contents in parallel (max 5 at a time)
    const batches: any[][] = [];
    for (let i = 0; i < fileItems.length; i += 5) {
      batches.push(fileItems.slice(i, i + 5));
    }
    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (item: any) => {
          const content = await fetchRepoFile(item.path);
          return content ? { path: item.path.replace(dirPath + '/', ''), content, language: 'python' } : null;
        })
      );
      files.push(...results.filter(Boolean) as any[]);
    }

    // Recurse into subdirs
    for (const dir of dirItems) {
      const subFiles = await fetchDirContents(dir.path);
      files.push(...subFiles.map(f => ({
        ...f,
        path: `${dir.name}/${f.path}`,
      })));
    }
  } catch {
    // skip errors
  }
  return files;
}

// Clone a template directory into project files
export async function cloneTemplate(template: GitHubTemplate): Promise<ClonedTemplate> {
  const files = await fetchDirContents(template.path);
  return {
    name: template.name,
    files,
  };
}

// Predefined useful template paths from BeeWare Briefcase
export const BRIEFCASE_TEMPLATES = [
  { name: 'Toga (GUI)', path: 'changes', description: 'Changelog i historia zmian' },
  { name: 'Commands', path: 'src/briefcase/commands', description: 'Komendy CLI Briefcase (create, build, run, dev, update, package)' },
  { name: 'Platforms', path: 'src/briefcase/platforms', description: 'Adaptery platform (macOS, Windows, Linux, iOS, Android, Web)' },
  { name: 'Integrations', path: 'src/briefcase/integrations', description: 'Integracje (Docker, Xcode, itp.)' },
];
