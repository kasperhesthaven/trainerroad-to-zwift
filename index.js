const fetch = require("node-fetch");
const asyncSema = require("async-sema");
const fs = require("fs");

const WORKOUT_IDS = ["123", "456"];
const BASE_ENDPOINT = "https://www.trainerroad.com/api/workoutdetails/";
const TRAINER_ROAD_AUTH_TOKEN = "ABC";

const getWorkoutById = (workoutId) => {
  return fetch(BASE_ENDPOINT + workoutId, {
    headers: {
      cookie: `TrainerRoadAuth=${TRAINER_ROAD_AUTH_TOKEN}`,
    },
    body: null,
    method: "GET",
  })
    .then((workoutResponse) => workoutResponse.json())
    .catch((error) => console.error(error));
};

async function downloadWorkouts(workoutIds, requestLimit) {
  const rateLimit = asyncSema.RateLimit(requestLimit);

  for (const workoutId of workoutIds) {
    await rateLimit();

    getWorkoutById(workoutId).then((workoutResponse) => {
      const workout = workoutResponse.Workout;
      const workoutSeconds = workout.workoutData;
      const intervals = workout.intervalData;
      const mappedIntervals = [];
      const workoutName = workout.Details.WorkoutName;
      const workoutDescription = `${workout.Details.WorkoutDescription}\n\n${workout.Details.GoalDescription}\n\nhttps://www.trainerroad.com/cycling/workouts/${workout.Details.Id}`;

      for (let i = 1, length = intervals.length; i < length; i++) {
        const interval = intervals[i];

        const intervalLength = interval.End - interval.Start;
        const startSecond = interval.Start * 1000;
        const endSecond = interval.End * 1000;

        const workoutElements = workoutSeconds.filter((e) => e.seconds >= startSecond && e.seconds < endSecond);

        var firstElement = workoutElements[0];
        var lastElement = workoutElements[workoutElements.length - 1];

        var startFtp = firstElement.ftpPercent / 100;
        var endFtp = lastElement.ftpPercent / 100;

        if (startFtp === endFtp) {
          mappedIntervals.push(`<SteadyState Duration="${intervalLength}" Power="${startFtp}"></SteadyState>`);
        } else if (startFtp < endFtp) {
          mappedIntervals.push(`<Warmup Duration="${intervalLength}" PowerLow="${startFtp}" PowerHigh="${endFtp}"></Warmup>`);
        } else {
          mappedIntervals.push(`<Cooldown Duration="${intervalLength}" PowerLow="${startFtp}" PowerHigh="${endFtp}"></Cooldown>`);
        }
      }

      const workoutFile = `<workout_file>
	<author>TrainerRoad</author>
	<name>${workoutName}</name>
	<description><![CDATA[${workoutDescription}]]></description>
	<sportType>bike</sportType>
	<tags/>
	<workout>
		${mappedIntervals.join("\n        ")}
	</workout>
</workout_file>`;

      fs.writeFile(`${workoutName.replaceAll(" ", "_")}.zwo`, workoutFile, (error) => {
        if (error) throw error;
        console.log(`Generated ${workoutName}.zwo`);
      });
    });
  }
}

downloadWorkouts(WORKOUT_IDS, 5);
