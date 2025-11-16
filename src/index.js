// Cloudflare Worker for GitHub Contribution Graph Merger
// Usage: https://your-worker.workers.dev/?merge=user-2,user-3&years=3&theme=dark

const GITHUB_API = "https://api.github.com/graphql";

/**
 * Verify if a user has authorized the primary user to merge and display their contributions
 * Authorization is verified by checking for a gist with filename pattern:
 * github-contribution-merge-allow-{primaryUser}.md
 *
 * @param {string} additionalUser - The user to check authorization for
 * @param {string} primaryUser - The primary user requesting access
 * @param {string} githubToken - GitHub API token
 * @returns {Promise<boolean>} - True if authorized, false otherwise
 */
async function verifyUserAuthorization(
  additionalUser,
  primaryUser,
  githubToken,
) {
  try {
    // Fetch the user's gists
    const gistsUrl = `https://api.github.com/users/${additionalUser}/gists`;
    const response = await fetch(gistsUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "GitHub-Contribution-Merger",
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      console.warn(
        `Failed to fetch gists for ${additionalUser}: ${response.status}`,
      );
      return false;
    }

    const gists = await response.json();

    // Check for auth gist with filename pattern: github-contribution-merge-allow-{primaryUser}.md
    const authFilename = `github-contribution-merge-allow-${primaryUser}.md`;
    const authGist = gists.find((g) => g.files && g.files[authFilename]);

    if (!authGist) {
      console.warn(
        `No auth gist found for ${additionalUser} (expected filename: ${authFilename})`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `Error verifying authorization for ${additionalUser}:`,
      error,
    );
    return false;
  }
}

async function fetchContributions(username, year, githubToken) {
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year}-12-31T23:59:59Z`;

  const query = `
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(GITHUB_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "GitHub-Contribution-Graph-Worker",
    },
    body: JSON.stringify({
      query,
      variables: { username, from, to },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error(`GraphQL errors for ${username}:`, result.errors);
    throw new Error(result.errors[0].message);
  }

  if (!result.data || !result.data.user) {
    throw new Error(`User '${username}' not found`);
  }

  return result.data.user.contributionsCollection.contributionCalendar;
}

function mergeContributions(dataArray, usernames) {
  if (dataArray.length === 0) return null;

  const contributionMap = new Map();
  const userContributionData = {};

  // Merge all contributions by date
  dataArray.forEach((calendar, idx) => {
    const username = usernames[idx];

    calendar.weeks.forEach((week) => {
      week.contributionDays.forEach((day) => {
        // Track individual user contributions
        if (!userContributionData[day.date]) {
          userContributionData[day.date] = {};
        }
        userContributionData[day.date][username] = day.contributionCount;

        // Merge totals
        const existing = contributionMap.get(day.date) || 0;
        contributionMap.set(day.date, existing + day.contributionCount);
      });
    });
  });

  // Use the first calendar's structure as template
  const template = dataArray[0];
  const merged = {
    totalContributions: 0,
    weeks: [],
    userContributions: userContributionData,
  };

  template.weeks.forEach((week) => {
    const mergedWeek = {
      contributionDays: [],
    };

    week.contributionDays.forEach((day) => {
      const count = contributionMap.get(day.date) || 0;
      merged.totalContributions += count;

      mergedWeek.contributionDays.push({
        date: day.date,
        contributionCount: count,
        contributionLevel: getLevel(count),
      });
    });

    merged.weeks.push(mergedWeek);
  });

  return merged;
}

function getLevel(count) {
  if (count === 0) return "NONE";
  if (count < 5) return "FIRST_QUARTILE";
  if (count < 10) return "SECOND_QUARTILE";
  if (count < 20) return "THIRD_QUARTILE";
  return "FOURTH_QUARTILE";
}

// Theme definitions
const THEMES = {
  dark: {
    background: "#0d1117",
    yearLabel: "#f0f6fc",
    monthLabel: "#8b949e",
    dayLabel: "#8b949e",
    levels: {
      NONE: "#161b22",
      FIRST_QUARTILE: "#0e4429",
      SECOND_QUARTILE: "#006d32",
      THIRD_QUARTILE: "#26a641",
      FOURTH_QUARTILE: "#39d353",
    },
  },
  light: {
    background: "#ffffff",
    yearLabel: "#24292f",
    monthLabel: "#57606a",
    dayLabel: "#57606a",
    levels: {
      NONE: "#ebedf0",
      FIRST_QUARTILE: "#9be9a8",
      SECOND_QUARTILE: "#40c463",
      THIRD_QUARTILE: "#30a14e",
      FOURTH_QUARTILE: "#216e39",
    },
  },
  "solarized-dark": {
    background: "#002b36",
    yearLabel: "#839496",
    monthLabel: "#839496",
    dayLabel: "#839496",
    levels: {
      NONE: "#073642",
      FIRST_QUARTILE: "#268bd2",
      SECOND_QUARTILE: "#2aa198",
      THIRD_QUARTILE: "#859900",
      FOURTH_QUARTILE: "#b58900",
    },
  },
  "solarized-light": {
    background: "#fdf6e3",
    yearLabel: "#657b83",
    monthLabel: "#657b83",
    dayLabel: "#657b83",
    levels: {
      NONE: "#eee8d5",
      FIRST_QUARTILE: "#268bd2",
      SECOND_QUARTILE: "#2aa198",
      THIRD_QUARTILE: "#859900",
      FOURTH_QUARTILE: "#b58900",
    },
  },
  "nord-polar-night": {
    background: "#2e3440",
    yearLabel: "#d8dee9",
    monthLabel: "#d8dee9",
    dayLabel: "#d8dee9",
    levels: {
      NONE: "#3b4252",
      FIRST_QUARTILE: "#434c5e",
      SECOND_QUARTILE: "#4c566a",
      THIRD_QUARTILE: "#5e81ac",
      FOURTH_QUARTILE: "#88c0d0",
    },
  },
  "nord-frost": {
    background: "#2e3440",
    yearLabel: "#d8dee9",
    monthLabel: "#d8dee9",
    dayLabel: "#d8dee9",
    levels: {
      NONE: "#3b4252",
      FIRST_QUARTILE: "#8fbcbb",
      SECOND_QUARTILE: "#88c0d0",
      THIRD_QUARTILE: "#81a1c1",
      FOURTH_QUARTILE: "#5e81ac",
    },
  },
  "nord-aurora": {
    background: "#2e3440",
    yearLabel: "#d8dee9",
    monthLabel: "#d8dee9",
    dayLabel: "#d8dee9",
    levels: {
      NONE: "#3b4252",
      FIRST_QUARTILE: "#a3be8c",
      SECOND_QUARTILE: "#ebcb8b",
      THIRD_QUARTILE: "#d08770",
      FOURTH_QUARTILE: "#bf616a",
    },
  },
};

function getLevelColor(level, theme = "dark") {
  const colors = THEMES[theme]?.levels || THEMES.dark.levels;
  return colors[level] || colors.NONE;
}

function escapeXml(str) {
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
    }
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return `${month} ${day}`;
}

function generateTooltipContent(date, userContribs, usernames) {
  let content = `${formatDate(date)}:\n`;

  usernames.forEach((username) => {
    const count = userContribs[username] || 0;
    const text =
      count === 0
        ? `${username} no contributions`
        : `${username} ${count} contribution${count !== 1 ? "s" : ""}`;
    content += text + "\n";
  });

  return content.trim();
}

/**
 * Render a single year's contribution graph
 * @param {Object} calendar - The contribution calendar data
 * @param {number} year - The year to render
 * @param {Array<string>} usernames - List of usernames
 * @param {number} xOffset - X offset for positioning
 * @param {number} yOffset - Y offset for positioning
 * @param {string} theme - Color theme
 * @param {number} padding - Padding around the graph
 * @returns {Object} - SVG string and dimensions
 */
function renderYearGraph(
  calendar,
  year,
  usernames,
  xOffset,
  yOffset,
  theme = "dark",
  padding = 10,
) {
  const cellSize = 10;
  const cellGap = 3;
  const yearLabelHeight = 20;
  const monthLabelHeight = 15;
  const dayLabelWidth = 30;
  const weeks = calendar.weeks;

  const graphWidth = dayLabelWidth + weeks.length * (cellSize + cellGap);
  const graphHeight =
    yearLabelHeight + monthLabelHeight + 7 * (cellSize + cellGap);

  let svg = "";

  // Year label
  svg += `<text x="${xOffset + padding}" y="${yOffset + padding + 14}" class="year-label">${year}</text>\n`;

  // Month labels
  let currentMonth = "";
  let monthX = xOffset + padding + dayLabelWidth;

  weeks.forEach((week) => {
    if (week.contributionDays.length === 0) return;

    const date = new Date(week.contributionDays[0].date);
    const month = date.toLocaleDateString("en-US", { month: "short" });

    if (month !== currentMonth && date.getDate() <= 7) {
      svg += `<text x="${monthX}" y="${yOffset + padding + yearLabelHeight + 10}" class="month-label">${month}</text>\n`;
      currentMonth = month;
    }
    monthX += cellSize + cellGap;
  });

  // Day labels (Mon, Wed, Fri)
  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
  dayLabels.forEach((label, idx) => {
    if (label) {
      const y =
        yOffset +
        padding +
        yearLabelHeight +
        monthLabelHeight +
        idx * (cellSize + cellGap) +
        cellSize -
        2;
      svg += `<text x="${xOffset + padding}" y="${y}" class="day-label">${label}</text>\n`;
    }
  });

  // Contribution squares
  weeks.forEach((week, weekIdx) => {
    week.contributionDays.forEach((day, dayIdx) => {
      const x =
        xOffset + padding + dayLabelWidth + weekIdx * (cellSize + cellGap);
      const y =
        yOffset +
        padding +
        yearLabelHeight +
        monthLabelHeight +
        dayIdx * (cellSize + cellGap);
      const color = getLevelColor(day.contributionLevel, theme);

      const tooltipContent = generateTooltipContent(
        day.date,
        calendar.userContributions[day.date] || {},
        usernames,
      );

      svg += `<rect class="contribution-square" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" data-date="${escapeXml(day.date)}" data-count="${day.contributionCount}">\n`;
      svg += `  <title>${escapeXml(tooltipContent)}</title>\n`;
      svg += `</rect>\n`;
    });
  });

  return { svg, width: graphWidth, height: graphHeight };
}

/**
 * Generate SVG styles for contribution graphs
 * @param {Object} themeColors - Theme color configuration
 * @returns {string} - CSS styles
 */
function generateSVGStyles(themeColors) {
  return `
    .header-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 12px;
      font-weight: 600;
      fill: ${themeColors.yearLabel};
    }
    .year-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
      fill: ${themeColors.yearLabel};
    }
    .month-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 10px;
      fill: ${themeColors.monthLabel};
    }
    .day-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 9px;
      fill: ${themeColors.dayLabel};
    }
    .contribution-square {
      shape-rendering: geometricPrecision;
      outline: 1px solid rgba(27, 31, 35, 0.06);
      outline-offset: -1px;
    }`;
}

/**
 * Generate the complete SVG document
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @param {Array<string>} usernames - List of usernames
 * @param {Array<string>} graphSVGs - Array of year graph SVG strings
 * @param {string} theme - Color theme name
 * @param {number} padding - Padding value
 * @returns {string} - Complete SVG document
 */
function generateCompleteSVG(
  width,
  height,
  usernames,
  graphSVGs,
  theme,
  padding,
) {
  const themeColors = THEMES[theme] || THEMES.dark;
  const userListText = `Users - ${usernames.join(", ")}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <style>${generateSVGStyles(themeColors)}</style>
  <rect width="100%" height="100%" fill="${themeColors.background}"/>
  <text x="${padding}" y="${padding + 16}" class="header-label">${escapeXml(userListText)}</text>
  ${graphSVGs.join("\n")}
</svg>`;
}

function generateSVGVertical(yearData, usernames, theme = "dark") {
  const cellSize = 10;
  const cellGap = 3;
  const dayLabelWidth = 30;
  const graphSpacing = 20;
  const padding = 10;
  const headerHeight = 25;
  const bottomSpacing = 15; // Extra spacing at bottom to balance header

  // Calculate dimensions with balanced padding
  const maxWeeks = Math.max(...yearData.map((yd) => yd.calendar.weeks.length));
  const width =
    padding + dayLabelWidth + maxWeeks * (cellSize + cellGap) + padding;

  let currentY = padding + headerHeight;
  const graphSVGs = [];

  yearData.forEach((yd, idx) => {
    const result = renderYearGraph(
      yd.calendar,
      yd.year,
      usernames,
      0, // xOffset
      currentY,
      theme,
      padding,
    );
    graphSVGs.push(result.svg);
    currentY += result.height + (idx < yearData.length - 1 ? graphSpacing : 0);
  });

  // Add bottom spacing: padding + extra spacing to balance header
  const totalHeight = currentY + padding + bottomSpacing;

  return generateCompleteSVG(
    width,
    totalHeight,
    usernames,
    graphSVGs,
    theme,
    padding,
  );
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const mergeParam = url.searchParams.get("merge");
      const yearsParam = url.searchParams.get("years");
      const themeParam = url.searchParams.get("theme") || "dark";

      // Check for required environment variables
      if (!env.GITHUB_TOKEN) {
        return new Response("Error: GITHUB_TOKEN not configured.", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        });
      }

      if (!env.PRIMARY_USER) {
        return new Response("Error: PRIMARY_USER not configured.", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        });
      }

      const primaryUser = env.PRIMARY_USER.trim();

      // Parse additional users from query parameter
      let additionalUsers = [];
      if (mergeParam) {
        additionalUsers = mergeParam
          .split(",")
          .map((u) => u.trim())
          .filter((u) => u && u !== primaryUser); // Remove empty strings and dedupe primary user
      }

      // Verify authorization for each additional user (in parallel)
      const authorizedUsers = [primaryUser]; // Always include primary user

      const authorizationPromises = additionalUsers.map((additionalUser) =>
        verifyUserAuthorization(
          additionalUser,
          primaryUser,
          env.GITHUB_TOKEN,
        ).then((isAuthorized) => ({ user: additionalUser, isAuthorized })),
      );

      const authResults = await Promise.all(authorizationPromises);

      authResults.forEach(({ user, isAuthorized }) => {
        if (isAuthorized) {
          authorizedUsers.push(user);
        } else {
          console.warn(`Skipping unauthorized user: ${user}`);
        }
      });

      if (authorizedUsers.length === 0) {
        return new Response("Error: No authorized users to display", {
          status: 400,
          headers: { "Content-Type": "text/plain" },
        });
      }

      // Validate theme parameter
      const validThemes = [
        "dark",
        "light",
        "solarized-dark",
        "solarized-light",
        "nord-polar-night",
        "nord-frost",
        "nord-aurora",
      ];
      if (!validThemes.includes(themeParam)) {
        return new Response(
          `Error: Invalid theme parameter. Valid options: \n- ${validThemes.join("\n- ")}`,
          {
            status: 400,
            headers: { "Content-Type": "text/plain" },
          },
        );
      }

      // Parse years parameter - accepts count back from current year
      let years = [];
      const currentYear = new Date().getFullYear();

      if (yearsParam) {
        const yearCount = parseInt(yearsParam.trim());
        if (isNaN(yearCount) || yearCount < 1) {
          return new Response(
            "Error: Invalid years parameter. Use ?years=N where N is a positive number",
            {
              status: 400,
              headers: { "Content-Type": "text/plain" },
            },
          );
        }

        // Generate years counting back from current year, stop at 2008 (GitHub founded)
        for (let i = 0; i < yearCount; i++) {
          const year = currentYear - i;
          if (year < 2008) {
            break;
          }
          years.push(year);
        }
      } else {
        // Default to current year only
        years = [currentYear];
      }

      // Fetch data for all authorized users and years (in parallel)
      const yearPromises = years.map(async (year) => {
        const dataPromises = authorizedUsers.map((u) =>
          fetchContributions(u, year, env.GITHUB_TOKEN),
        );
        const dataArray = await Promise.all(dataPromises);
        const merged = mergeContributions(dataArray, authorizedUsers);
        return { year, calendar: merged };
      });

      const yearData = await Promise.all(yearPromises);

      // Generate SVG
      const svg = generateSVGVertical(yearData, authorizedUsers, themeParam);

      // Optimized caching strategy for GitHub Camo proxy:
      // - s-maxage=300 (5 min): Short CDN/proxy cache to keep Camo responsive
      // - max-age=300 (5 min): Browser cache duration
      // - stale-while-revalidate=86400 (24h): Serve stale content while fetching fresh
      // - stale-if-error=604800 (7d): Serve stale if origin is down
      // This ensures Camo can serve cached content immediately while background refresh happens
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=86400, stale-if-error=604800",
          "Access-Control-Allow-Origin": "*",
          ETag: `W/"${Date.now()}"`, // Weak ETag for conditional requests
        },
      });
    } catch (error) {
      console.error("Error:", error);
      return new Response(
        "An error occurred while generating the contribution graph",
        {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        },
      );
    }
  },
};
