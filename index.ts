import { parseArgs } from "util";

// run if args provided from cli
if (import.meta.main) {
  run(args());
}

/**
  parse cli args
  @example
  ./pga-cli --statsId 02675 --year 2021 --dir data
  ./pga-cli -s 02675 -y 2021 -d data
*/
function args() {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      statsId: { type: "string", short: "s" },
      year: { type: "string", short: "y" },
      dir: { type: "string", short: "d" },
    },
    strict: true,
    allowPositionals: true,
  });

  const { statsId, year, dir } = values;

  if (!statsId) throw new Error("Missing statsId");
  if (!year) throw new Error("Missing year");

  return { statsId, year, dir };
}

type Params = { year: number | string; statsId: string; dir?: string };
async function run({ year, statsId, dir = "data" }: Params) {
  const tournies = await getTournaments({ year });

  const tournies_hash: Record<string, string> = {};
  tournies.data.statDetails.tournamentPills.forEach(
    async ({ tournamentId, displayName }) => {
      tournies_hash[tournamentId] = displayName;
      const csv = await downloadCSV({ tournamentId, statsId });
      await Bun.write(`./${dir}/${tournamentId}.csv`, csv);
    }
  );

  await Bun.write(
    `./${dir}/tournaments.json`,
    JSON.stringify(tournies_hash, null, 2)
  );

  const courses = await getCourses({ year });
  await Bun.write(`./${dir}/courses.json`, JSON.stringify(courses, null, 2));
}

async function getTournaments({ year }: { year: number | string }) {
  const res = await fetch("https://orchestrator.pgatour.com/graphql", {
    headers: { "x-api-key": "da2-gsrx5bibzbb4njvhl7t37wqyl4" },
    body: JSON.stringify({
      operationName: "StatDetails",
      variables: {
        tourCode: "R",
        statId: "02675",
        year,
        eventQuery: null,
      },
      query: `query StatDetails($tourCode: TourCode!, $statId: String!, $year: Int, $eventQuery: StatDetailEventQuery) {
                statDetails(
                  tourCode: $tourCode
                  statId: $statId
                  year: $year
                  eventQuery: $eventQuery
                ) {
                    tourCode
                    year
                    statId
                    statType
                    statTitle
                    lastProcessed
                    tournamentPills {
                      tournamentId
                      displayName
                    }
                    yearPills {
                      year
                      displaySeason
                    }
                    statCategories {
                      category
                      displayName
                      subCategories {
                        displayName
                        stats {
                          statId
                          statTitle
                        }
                      }
                    }
                  }
              }`,
    }),
    method: "POST",
  });

  return (await res.json()) as TournamentsData;
}

type TournamentsData = {
  data: {
    statDetails: {
      tourCode: string;
      year: number;
      statId: string;
      statType: string;
      statTitle: string;
      lastProcessed: string;
      tournamentPills: Array<{ tournamentId: string; displayName: string }>;
      yearPills: Array<{ year: number; displaySeason: number }>;
      statCategories: Array<{
        category: string;
        displayName: string;
        subCategories: Array<{
          displayName: string;
          stats: Array<{ statId: string; statTitle: string }>;
        }>;
      }>;
    };
  };
};

type CSVParams = { tournamentId: string; statsId: string };
async function downloadCSV({ tournamentId, statsId }: CSVParams) {
  const res = await fetch(
    `https://www.pgatour.com/api/stats-download?timePeriod=EVENT_ONLY&statsId=${statsId}&tournamentId=${tournamentId}`
  );

  return await res.text();
}

async function getCourses({ year }: { year: number | string }) {
  const res = await fetch("https://orchestrator.pgatour.com/graphql", {
    headers: { "x-api-key": "da2-gsrx5bibzbb4njvhl7t37wqyl4" },
    body: JSON.stringify({
      operationName: "CourseStatsDetails",
      variables: {
        tourCode: "R",
        round: "ALL",
        year,
        queryType: "TOUGHEST_COURSE",
      },
      query: `query CourseStatsDetails($tourCode: TourCode!, $queryType: CourseStatsId!, $round: ToughestRound, $year: Int) {
                courseStatsDetails(
                  tourCode: $tourCode
                  queryType: $queryType
                  round: $round
                  year: $year
                ) {
                  tourCode
                  year
                  round
                  headers
                  displayName
                  tableName
                  rows {
                    rank
                    displayName
                    values {
                      value
                      tendency
                    }
                    tournamentId
                    tournamentName
                  }
                }
              }`,
    }),
    method: "POST",
  });

  return (await res.json()) as CoursesData;
}

type CoursesData = {
  data: {
    courseStatsDetails: {
      tourCode: string;
      year: number;
      round: string;
      headers: string[];
      displayName: string;
      tableName: string;
      rows: Array<{
        rank: number;
        displayName: string;
        values: Array<{ value: string; tendency: string | null }>;
        tournamentId: string;
        tournamentName: string;
      }>;
    };
  };
};
