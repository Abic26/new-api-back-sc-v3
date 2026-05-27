const DEFAULT_OSRM_ENDPOINT = "https://router.project-osrm.org";
const DEFAULT_GOOGLE_ROADS_ENDPOINT = "https://roads.googleapis.com/v1/snapToRoads";
const DEFAULT_VALHALLA_ENDPOINT = "http://localhost:8002";
const DEFAULT_MAPBOX_ENDPOINT = "https://api.mapbox.com/matching/v5/mapbox";

const PROVIDERS = {
  VALHALLA: "valhalla",
  OSRM: "osrm",
};
const PROFILE_ALIASES = {
  mapbox: {
    auto: "driving",
    pedestrian: "walking",
    bicycle: "cycling",
    driving: "driving",
    walking: "walking",
    cycling: "cycling",
  },
  osrm: {
    auto: "driving",
    pedestrian: "foot",
    bicycle: "bike",
    driving: "driving",
    walking: "foot",
    foot: "foot",
    cycling: "bike",
    bike: "bike",
  },
  valhalla: {
    auto: "auto",
    driving: "auto",
    pedestrian: "pedestrian",
    walking: "pedestrian",
    foot: "pedestrian",
    bicycle: "bicycle",
    cycling: "bicycle",
  },
};

const envNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const envList = (name, fallback) => {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const MAX_ACCEPTED_ACCURACY_METERS = envNumber("MAX_ACCEPTED_ACCURACY_METERS", 45);
const MIN_DISTANCE_METERS = envNumber("MIN_DISTANCE_METERS", 2);
const PAUSE_RADIUS_METERS = envNumber("PAUSE_RADIUS_METERS", 15);
const PAUSE_MIN_DURATION_SECONDS = envNumber("PAUSE_MIN_DURATION_SECONDS", 60);
const MAX_REASONABLE_SPEED_METERS_PER_SECOND = envNumber(
  "MAX_REASONABLE_SPEED_METERS_PER_SECOND",
  35,
);
const MAX_POINTS_PER_REQUEST = Math.min(
  envNumber("MAX_POINTS_PER_REQUEST", 100),
  100,
);
const REQUEST_OVERLAP = Math.max(envNumber("REQUEST_OVERLAP", 2), 1);
const SIMPLIFY_TOLERANCE_METERS = envNumber("SIMPLIFY_TOLERANCE_METERS", 1.8);
const MATCHING_MIN_DISTANCE_METERS = envNumber("MATCHING_MIN_DISTANCE_METERS", 4);
const MAX_MATCH_DISTANCE_FROM_RAW_METERS = envNumber(
  "MAX_MATCH_DISTANCE_FROM_RAW_METERS",
  80,
);
const MAX_MATCH_POINT_DISTANCE_FROM_RAW_METERS = envNumber(
  "MAX_MATCH_POINT_DISTANCE_FROM_RAW_METERS",
  120,
);
const MAX_DISTANCE_MULTIPLIER = envNumber("MAX_MATCH_DISTANCE_MULTIPLIER", 4);
const MAX_MATCH_DISTANCE_EXTRA_KM = envNumber("MAX_MATCH_DISTANCE_EXTRA_KM", 1.5);
const OSRM_NEAREST_MAX_DISTANCE_METERS = envNumber(
  "OSRM_NEAREST_MAX_DISTANCE_METERS",
  60,
);
const OSRM_ROUTE_ANCHOR_DISTANCE_METERS = envNumber(
  "OSRM_ROUTE_ANCHOR_DISTANCE_METERS",
  8,
);
const OSRM_ROUTE_NEAREST_FALLBACK =
  String(process.env.OSRM_ROUTE_NEAREST_FALLBACK || "false").toLowerCase() ===
  "true";
const FETCH_TIMEOUT_MS = envNumber("MAP_MATCHING_TIMEOUT_MS", 9000);

const OSRM_ENDPOINT = process.env.OSRM_ENDPOINT || DEFAULT_OSRM_ENDPOINT;
const MAPBOX_ENDPOINT = process.env.MAPBOX_ENDPOINT || DEFAULT_MAPBOX_ENDPOINT;
const GOOGLE_ROADS_ENDPOINT =
  process.env.GOOGLE_ROADS_ENDPOINT || DEFAULT_GOOGLE_ROADS_ENDPOINT;
const VALHALLA_ENDPOINT = process.env.VALHALLA_ENDPOINT || DEFAULT_VALHALLA_ENDPOINT;

export const buildMatchedTrack = async (gpsTrack = []) => {
  const normalizedTrack = normalizeTrack(gpsTrack);
  const cleanedTrack = cleanTrack(normalizedTrack);
  const movementTrack = classifyMovement(cleanedTrack);
  const matchingTrack = prepareTrackForMatching(movementTrack);
  const collapsedTrack = collapsePauseClusters(movementTrack);

  if (movementTrack.length < 2) {
    return {
      track: movementTrack,
      status: "empty",
      error: null,
    };
  }

  const matched = await matchTrackToRoads(matchingTrack);
  if (matched?.track?.length >= 2) {
    return {
      track: matched.track,
      status: `${matched.status}:${matched.provider}:${matched.profile}`,
      error: matched.error,
    };
  }

  return {
    track: smoothAndSimplifyTrack(collapsedTrack),
    status: "fallback:local",
    error:
      matched?.error ||
      "No se pudo ajustar contra calles/senderos; se aplico suavizado local.",
  };
};

const matchTrackToRoads = async (track, options = {}) => {
  const providers = providerPriority(options);
  const errors = [];

  for (const provider of providers) {
    if (!providerIsConfigured(provider)) {
      errors.push(`${provider}: not configured`);
      continue;
    }

    try {
      const result = await matchWithProvider(provider, track, options);
      const validation = validateMatchedTrack(track, result?.track || []);

      if (validation.valid) {
        return {
          track: result.track,
          provider,
          profile: result.profile,
          status: result.status || "matched",
          error: null,
        };
      }

      if (provider === PROVIDERS.OSRM) {
        const fallbackResult = await retryOsrmWithNearest(track, validation.reason, options);
        const fallbackValidation = validateMatchedTrack(track, fallbackResult?.track || []);

        if (fallbackValidation.valid) {
          return {
            track: fallbackResult.track,
            provider,
            profile: fallbackResult.profile,
            status: fallbackResult.status,
            error: null,
          };
        }

        errors.push(`${provider}: ${validation.reason}; nearest ${fallbackValidation.reason}`);
        continue;
      }

      errors.push(`${provider}: ${validation.reason}`);
    } catch (error) {
      errors.push(`${provider}: ${error.message}`);
    }
  }

  return {
    track: null,
    provider: null,
    profile: null,
    status: "failed",
    error: errors.join(" | "),
  };
};

const providerPriority = (options = {}) => {
  const selected = (options.provider || process.env.MAP_MATCHING_PROVIDER || "osrm")
    .toLowerCase()
    .trim();

  if (selected === PROVIDERS.VALHALLA) {
    return uniqueProviders([PROVIDERS.VALHALLA, PROVIDERS.OSRM]);
  }

  const fallbackProviders = envList("MAP_MATCHING_FALLBACK_PROVIDERS", [])
    .map((provider) => provider.toLowerCase());
  return uniqueProviders([
    PROVIDERS.OSRM,
    ...fallbackProviders.filter((provider) => provider === PROVIDERS.VALHALLA),
  ]);
};

const uniqueProviders = (providers) => {
  return [...new Set(providers)].filter((provider) =>
    Object.values(PROVIDERS).includes(provider),
  );
};

const providerIsConfigured = (provider) => {
  if (provider === PROVIDERS.VALHALLA) return Boolean(process.env.VALHALLA_ENDPOINT);
  if (provider === PROVIDERS.OSRM) return Boolean(OSRM_ENDPOINT);
  return false;
};

const matchWithProvider = async (provider, track, options = {}) => {
  if (provider === PROVIDERS.VALHALLA) return matchWithValhalla(track, options);
  return matchWithOsrm(track, options);
};

const normalizeTrack = (track) => {
  if (!Array.isArray(track)) return [];

  return track
    .map((point, rawIndex) => {
      const lat = toNumber(point?.lat ?? point?.latitude);
      const lng = toNumber(point?.lng ?? point?.longitude);
      if (!isValidCoordinate(lat, lng)) return null;

      return {
        lat,
        lng,
        timestamp: toTimestamp(point?.timestamp, rawIndex),
        accuracy: toOptionalNumber(point?.accuracy),
        speed: toOptionalNumber(point?.speed),
        rawIndex,
        moving: true,
        paused: false,
        source: "raw",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp || a.rawIndex - b.rawIndex)
    .filter((point, index, sorted) => {
      if (index === 0) return true;
      return point.timestamp > sorted[index - 1].timestamp;
    });
};

const cleanTrack = (track) => {
  return filterImpossibleJumps(removeDuplicatePoints(track));
};

const retryOsrmWithNearest = async (track, reason, options = {}) => {
  if (
    reason !== "matched distance is unreasonable" &&
    reason !== "matched track is too far from raw track" &&
    reason !== "matched track has far points from raw track"
  ) {
    return null;
  }

  const profiles = envList("OSRM_PROFILES", [
    profileForProvider(PROVIDERS.OSRM, options.profile),
    "foot",
    "walking",
    "driving",
  ]);
  const snapped = await snapWithOsrmNearest(track, profiles);

  if (snapped.length < 2) return null;

  return {
    track: snapped,
    profile: "nearest",
    status: "snapped",
  };
};

const prepareTrackForMatching = (track) => {
  if (track.length <= MAX_POINTS_PER_REQUEST) return track;

  const prepared = [track[0]];

  for (const point of track.slice(1, -1)) {
    const previous = prepared[prepared.length - 1];
    const distance = distanceMeters(previous, point);
    const elapsedSeconds = Math.max((point.timestamp - previous.timestamp) / 1000, 1);

    if (
      distance >= MATCHING_MIN_DISTANCE_METERS ||
      elapsedSeconds >= PAUSE_MIN_DURATION_SECONDS ||
      point.paused !== previous.paused
    ) {
      prepared.push(point);
    }
  }

  prepared.push(track[track.length - 1]);
  return prepared;
};

const removeDuplicatePoints = (track) => {
  if (track.length < 2) return track;

  const cleaned = [track[0]];

  for (const point of track.slice(1)) {
    if (point.accuracy && point.accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
      continue;
    }

    const previous = cleaned[cleaned.length - 1];
    const distance = distanceMeters(previous, point);
    const elapsedSeconds = Math.max((point.timestamp - previous.timestamp) / 1000, 1);

    if (distance < MIN_DISTANCE_METERS && elapsedSeconds < PAUSE_MIN_DURATION_SECONDS) {
      continue;
    }

    cleaned.push(point);
  }

  return cleaned;
};

const filterImpossibleJumps = (track) => {
  if (track.length < 2) return track;

  const filtered = [track[0]];

  for (const point of track.slice(1)) {
    const previous = filtered[filtered.length - 1];
    const distance = distanceMeters(previous, point);
    const elapsedSeconds = Math.max((point.timestamp - previous.timestamp) / 1000, 1);
    const inferredSpeed = distance / elapsedSeconds;
    const reportedSpeed = point.speed && point.speed > 0 ? point.speed : inferredSpeed;

    if (
      reportedSpeed > MAX_REASONABLE_SPEED_METERS_PER_SECOND ||
      inferredSpeed > MAX_REASONABLE_SPEED_METERS_PER_SECOND
    ) {
      continue;
    }

    filtered.push(point);
  }

  return filtered.length >= 2 ? filtered : track.slice(0, 2);
};

const classifyMovement = (track) => {
  if (track.length < 2) return track;

  return track.map((point, index) => {
    const previous = index > 0 ? track[index - 1] : null;
    const next = index < track.length - 1 ? track[index + 1] : null;
    const reference = previous || next;
    const elapsedSeconds = reference
      ? Math.max(Math.abs(point.timestamp - reference.timestamp) / 1000, 1)
      : 1;
    const distance = reference ? distanceMeters(point, reference) : 0;
    const inferredSpeed = distance / elapsedSeconds;
    const speed = point.speed && point.speed > 0 ? point.speed : inferredSpeed;

    return {
      ...point,
      speed,
      moving: speed >= 0.5,
      paused: speed < 0.5,
    };
  });
};

const collapsePauseClusters = (track) => {
  if (track.length < 3) return track;

  const result = [];
  let index = 0;

  while (index < track.length) {
    const cluster = [track[index]];
    let cursor = index + 1;

    while (
      cursor < track.length &&
      distanceMeters(track[index], track[cursor]) <= PAUSE_RADIUS_METERS
    ) {
      cluster.push(track[cursor]);
      cursor += 1;
    }

    const durationSeconds =
      (cluster[cluster.length - 1].timestamp - cluster[0].timestamp) / 1000;
    const hasPauseSpeed = cluster.some((point) => point.paused);

    if (
      cluster.length > 2 &&
      durationSeconds >= PAUSE_MIN_DURATION_SECONDS &&
      hasPauseSpeed
    ) {
      const representative = centroidPoint(cluster);
      result.push({
        ...representative,
        timestamp: cluster[0].timestamp,
        moving: false,
        paused: true,
        source: "pause_start",
      });
      result.push({
        ...representative,
        timestamp: cluster[cluster.length - 1].timestamp,
        moving: false,
        paused: true,
        source: "pause_end",
      });
    } else {
      result.push(track[index]);
    }

    index = Math.max(cursor, index + 1);
  }

  return result;
};

const centroidPoint = (points) => {
  const total = points.reduce(
    (acc, point) => {
      acc.lat += point.lat;
      acc.lng += point.lng;
      acc.accuracy += point.accuracy || 0;
      return acc;
    },
    { lat: 0, lng: 0, accuracy: 0 },
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
    accuracy: total.accuracy ? total.accuracy / points.length : null,
    speed: 0,
    rawIndex: points[0].rawIndex,
  };
};

const matchWithMapbox = async (track, options = {}) => {
  const profile = profileForProvider(PROVIDERS.MAPBOX, options.profile);
  const chunks = chunkTrack(track);
  const matched = [];

  for (const chunk of chunks) {
    const coordinates = chunk.map((point) => `${point.lng},${point.lat}`).join(";");
    const radiuses = chunk.map(radiusForPoint).join(";");
    const timestamps = chunk.map((point) => Math.floor(point.timestamp / 1000)).join(";");
    const url = new URL(`${MAPBOX_ENDPOINT}/${profile}/${coordinates}`);

    url.searchParams.set("access_token", process.env.MAPBOX_ACCESS_TOKEN);
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("overview", "full");
    url.searchParams.set("steps", "false");
    url.searchParams.set("tidy", "true");
    url.searchParams.set("radiuses", radiuses);
    url.searchParams.set("timestamps", timestamps);

    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!response?.ok) throw new Error(`mapbox http ${response?.status || "error"}`);

    const data = await response.json();
    const coordinatesOut = data?.matchings?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinatesOut)) throw new Error("mapbox empty geometry");

    appendChunk(
      matched,
      coordinatesOut.map(([lng, lat], index) =>
        pointFromMatchedCoordinate(lat, lng, chunk, index, coordinatesOut.length, "mapbox"),
      ),
    );
  }

  return { track: matched, provider: PROVIDERS.MAPBOX, profile, status: "matched" };
};

const matchWithGoogleRoads = async (track) => {
  const chunks = chunkTrack(track);
  const matched = [];

  for (const chunk of chunks) {
    const path = chunk.map((point) => `${point.lat},${point.lng}`).join("|");
    const url = new URL(GOOGLE_ROADS_ENDPOINT);
    url.searchParams.set("path", path);
    url.searchParams.set("interpolate", "true");
    url.searchParams.set("key", process.env.GOOGLE_ROADS_API_KEY);

    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!response?.ok) throw new Error(`google http ${response?.status || "error"}`);

    const data = await response.json();
    const snappedPoints = data?.snappedPoints;
    if (!Array.isArray(snappedPoints) || snappedPoints.length < 2) {
      throw new Error("google empty snappedPoints");
    }

    appendChunk(
      matched,
      snappedPoints
        .map((point, index) => {
          const location = point.location;
          if (!location) return null;
          const originalIndex = Number.isInteger(point.originalIndex)
            ? point.originalIndex
            : null;
          const timestamp = originalIndex === null
            ? interpolateTimestamp(chunk, index, snappedPoints.length)
            : chunk[originalIndex]?.timestamp || interpolateTimestamp(chunk, index, snappedPoints.length);

          return {
            lat: Number(location.latitude),
            lng: Number(location.longitude),
            timestamp,
            rawIndex: originalIndex === null ? null : chunk[originalIndex]?.rawIndex,
            moving: true,
            paused: false,
            source: "google",
          };
        })
        .filter((point) => point && isValidCoordinate(point.lat, point.lng)),
    );
  }

  return { track: matched, provider: PROVIDERS.GOOGLE, profile: "snapToRoads", status: "matched" };
};

const matchWithValhalla = async (track, options = {}) => {
  const profile = profileForProvider(PROVIDERS.VALHALLA, options.profile);
  const chunks = chunkTrack(track);
  const matched = [];

  for (const chunk of chunks) {
    const url = new URL("/trace_route", VALHALLA_ENDPOINT);
    const body = {
      shape: chunk.map((point) => ({
        lat: point.lat,
        lon: point.lng,
        time: Math.floor(point.timestamp / 1000),
        accuracy: radiusForPoint(point),
      })),
      costing: profile,
      shape_match: "map_snap",
      filters: {
        attributes: ["shape"],
        action: "include",
      },
    };

    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response?.ok) throw new Error(`valhalla http ${response?.status || "error"}`);

    const data = await response.json();
    const shape = extractValhallaShape(data);
    if (!shape.length) throw new Error("valhalla empty shape");

    appendChunk(
      matched,
      shape.map((point, index) =>
        pointFromMatchedCoordinate(point.lat, point.lng, chunk, index, shape.length, "valhalla"),
      ),
    );
  }

  return { track: matched, provider: PROVIDERS.VALHALLA, profile, status: "matched" };
};

const matchWithOsrm = async (track, options = {}) => {
  const profiles = envList("OSRM_PROFILES", [
    profileForProvider(PROVIDERS.OSRM, options.profile),
    "driving",
    "car",
    "foot",
    "walking",
    "bike",
    "cycling",
  ]);
  const radiuses = envList("OSRM_RADII_METERS", ["12", "25", "45", "70", "100"])
    .map(Number)
    .filter(Number.isFinite);

  for (const profile of [...new Set(profiles)]) {
    try {
      const matched = await matchOsrmProfile(track, profile, radiuses);
      if (matched.length >= 2) {
        return { track: matched, provider: PROVIDERS.OSRM, profile, status: "matched" };
      }
    } catch {
      // Try next profile.
    }
  }

  const snapped = await snapWithOsrmNearest(track, profiles);
  if (snapped.length >= 2) {
    return {
      track: snapped,
      provider: PROVIDERS.OSRM,
      profile: "nearest",
      status: "snapped",
    };
  }

  throw new Error("osrm failed all profiles");
};

const matchOsrmProfile = async (track, profile, radiuses) => {
  const chunks = chunkTrack(track);
  const matched = [];

  for (const chunk of chunks) {
    const matchedChunk =
      await matchOsrmChunk(chunk, profile, radiuses) ||
      await routeOsrmNearestChunk(chunk, profile);

    if (!matchedChunk.length) continue;
    appendChunk(matched, matchedChunk);
  }

  if (matched.length < 2) throw new Error(`osrm empty profile ${profile}`);
  return matched;
};

const matchOsrmChunk = async (chunk, profile, radiuses) => {
  const strategies = [
    { gaps: "split", tidy: "true" },
    { gaps: "ignore", tidy: "true" },
    { gaps: "split", tidy: "false" },
    { gaps: "ignore", tidy: "false" },
  ];

  for (const strategy of strategies) {
    for (const radius of radiuses) {
    const coordinates = chunk.map((point) => `${point.lng},${point.lat}`).join(";");
    const url = new URL(`${OSRM_ENDPOINT}/match/v1/${profile}/${coordinates}`);
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("overview", "full");
    url.searchParams.set("steps", "false");
    url.searchParams.set("annotations", "false");
      url.searchParams.set("gaps", strategy.gaps);
      url.searchParams.set("tidy", strategy.tidy);
    url.searchParams.set("radiuses", chunk.map((point) => Math.max(radius, radiusForPoint(point))).join(";"));
    url.searchParams.set("timestamps", strictlyIncreasingTimestamps(chunk).join(";"));

    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!response?.ok) continue;

    const data = await response.json();
    const coordinatesOut = data?.matchings?.flatMap((matching) =>
      matching?.geometry?.coordinates || [],
    );

    if (Array.isArray(coordinatesOut) && coordinatesOut.length >= 2) {
      return coordinatesOut
        .map(([lng, lat], index) =>
          pointFromMatchedCoordinate(lat, lng, chunk, index, coordinatesOut.length, "osrm"),
        )
        .filter((point) => isValidCoordinate(point.lat, point.lng));
    }
  }
  }

  return null;
};

const routeOsrmNearestChunk = async (chunk, profile) => {
  const snapped = await snapChunkWithOsrmNearest(chunk, profile);
  if (snapped.length < 2) return [];

  if (!OSRM_ROUTE_NEAREST_FALLBACK) return snapped;

  const routed = await routeOsrmAnchors(snapped, profile);
  return routed.length >= 2 ? routed : snapped;
};

const snapWithOsrmNearest = async (track, profiles = ["driving"]) => {
  for (const profile of [...new Set([...profiles, "driving"])]) {
    const snapped = [];

    for (const chunk of chunkTrack(track)) {
      const snappedChunk = await routeOsrmNearestChunk(chunk, profile);
      if (snappedChunk.length >= 2) appendChunk(snapped, snappedChunk);
    }

    if (snapped.length >= 2) return snapped;
  }

  return [];
};

const snapChunkWithOsrmNearest = async (track, profile) => {
  const snapped = [];

  for (const point of track) {
    const snappedPoint = await requestOsrmNearest(point, profile);
    if (!snappedPoint) continue;

    const previous = snapped[snapped.length - 1];
    if (!previous || distanceMeters(previous, snappedPoint) >= MIN_DISTANCE_METERS) {
      snapped.push(snappedPoint);
    }
  }

  return snapped;
};

const requestOsrmNearest = async (point, profile) => {
  const url = new URL(`${OSRM_ENDPOINT}/nearest/v1/${profile}/${point.lng},${point.lat}`);
  url.searchParams.set("number", "1");

  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response?.ok) return null;

  const data = await response.json();
  const waypoint = Array.isArray(data?.waypoints) ? data.waypoints[0] : null;
  const location = waypoint?.location;
  const distance = Number(waypoint?.distance);

  if (
    !Array.isArray(location) ||
    location.length < 2 ||
    !Number.isFinite(distance) ||
    distance > Math.max(OSRM_NEAREST_MAX_DISTANCE_METERS, radiusForPoint(point) * 3)
  ) {
    return null;
  }

  const [lng, lat] = location;
  if (!isValidCoordinate(lat, lng)) return null;

  return {
    ...point,
    lat,
    lng,
    source: "osrm:nearest",
  };
};

const routeOsrmAnchors = async (snapped, profile) => {
  const anchors = thinRouteAnchors(snapped);
  if (anchors.length < 2) return [];

  const coordinates = anchors.map((point) => `${point.lng},${point.lat}`).join(";");
  const url = new URL(`${OSRM_ENDPOINT}/route/v1/${profile}/${coordinates}`);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "false");
  url.searchParams.set("continue_straight", "false");

  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response?.ok) return [];

  const data = await response.json();
  const coordinatesOut = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinatesOut) || coordinatesOut.length < 2) return [];

  return coordinatesOut
    .map(([lng, lat], index) =>
      pointFromMatchedCoordinate(
        lat,
        lng,
        anchors,
        index,
        coordinatesOut.length,
        "osrm:route",
      ),
    )
    .filter((point) => isValidCoordinate(point.lat, point.lng));
};

const thinRouteAnchors = (track) => {
  if (track.length <= 2) return track;

  const anchors = [track[0]];

  for (const point of track.slice(1, -1)) {
    const previous = anchors[anchors.length - 1];

    if (
      distanceMeters(previous, point) >= OSRM_ROUTE_ANCHOR_DISTANCE_METERS ||
      point.paused !== previous.paused
    ) {
      anchors.push(point);
    }
  }

  anchors.push(track[track.length - 1]);
  return anchors;
};

const validateMatchedTrack = (rawTrack, matchedTrack) => {
  if (!Array.isArray(matchedTrack) || matchedTrack.length < 2) {
    return { valid: false, reason: "matched track has less than 2 points" };
  }

  if (!matchedTrack.every((point) => isValidCoordinate(point.lat, point.lng))) {
    return { valid: false, reason: "matched track has invalid coordinates" };
  }

  if (hasHugeJumps(matchedTrack)) {
    return { valid: false, reason: "matched track has huge jumps" };
  }

  const rawDistance = calculateTrackDistance(rawTrack);
  const matchedDistance = calculateTrackDistance(matchedTrack);
  if (
    rawDistance > 0.02 &&
    matchedDistance > rawDistance * MAX_DISTANCE_MULTIPLIER &&
    matchedDistance - rawDistance > MAX_MATCH_DISTANCE_EXTRA_KM
  ) {
    return { valid: false, reason: "matched distance is unreasonable" };
  }

  const averageDistance = averageDistanceToRawTrack(rawTrack, matchedTrack);
  if (averageDistance > MAX_MATCH_DISTANCE_FROM_RAW_METERS) {
    return { valid: false, reason: "matched track is too far from raw track" };
  }

  const maxDistance = maxDistanceToRawTrack(rawTrack, matchedTrack);
  if (maxDistance > MAX_MATCH_POINT_DISTANCE_FROM_RAW_METERS) {
    return {
      valid: false,
      reason: "matched track has far points from raw track",
    };
  }

  return { valid: true, reason: null };
};

const averageDistanceToRawTrack = (rawTrack, matchedTrack) => {
  if (!rawTrack.length || !matchedTrack.length) return Infinity;

  const sampleStep = Math.max(Math.floor(matchedTrack.length / 50), 1);
  let total = 0;
  let count = 0;

  for (let index = 0; index < matchedTrack.length; index += sampleStep) {
    const point = matchedTrack[index];
    const nearest = rawTrack.reduce((best, raw) => {
      const distance = distanceMeters(point, raw);
      return distance < best ? distance : best;
    }, Infinity);
    total += nearest;
    count += 1;
  }

  return total / Math.max(count, 1);
};

const maxDistanceToRawTrack = (rawTrack, matchedTrack) => {
  if (!rawTrack.length || !matchedTrack.length) return Infinity;

  const sampleStep = Math.max(Math.floor(matchedTrack.length / 80), 1);
  let maxDistance = 0;

  for (let index = 0; index < matchedTrack.length; index += sampleStep) {
    const point = matchedTrack[index];
    const nearest = rawTrack.reduce((best, raw) => {
      const distance = distanceMeters(point, raw);
      return distance < best ? distance : best;
    }, Infinity);
    maxDistance = Math.max(maxDistance, nearest);
  }

  return maxDistance;
};

const hasHugeJumps = (track) => {
  for (let index = 1; index < track.length; index += 1) {
    if (distanceMeters(track[index - 1], track[index]) > 500) return true;
  }

  return false;
};

const calculateTrackDistance = (track) => {
  let total = 0;

  for (let index = 1; index < track.length; index += 1) {
    total += distanceMeters(track[index - 1], track[index]);
  }

  return total / 1000;
};

const smoothAndSimplifyTrack = (track) => {
  if (track.length < 3) return track;
  return simplifyTrack(smoothTrack(track), SIMPLIFY_TOLERANCE_METERS);
};

const smoothTrack = (track) => {
  const smoothed = [track[0]];

  for (let i = 1; i < track.length - 1; i += 1) {
    const previous = track[i - 1];
    const current = track[i];
    const next = track[i + 1];

    if (current.paused) {
      smoothed.push(current);
      continue;
    }

    smoothed.push({
      ...current,
      lat: previous.lat * 0.15 + current.lat * 0.7 + next.lat * 0.15,
      lng: previous.lng * 0.15 + current.lng * 0.7 + next.lng * 0.15,
      source: `${current.source || "track"}:smoothed`,
    });
  }

  smoothed.push(track[track.length - 1]);
  return smoothed;
};

const simplifyTrack = (track, toleranceMeters) => {
  if (track.length <= 2) return track;

  const keep = Array(track.length).fill(false);
  keep[0] = true;
  keep[track.length - 1] = true;
  markSimplifiedPoints(track, keep, 0, track.length - 1, toleranceMeters);

  return track.filter((point, index) => keep[index] || point.paused);
};

const markSimplifiedPoints = (track, keep, start, end, toleranceMeters) => {
  if (end <= start + 1) return;

  let maxDistance = 0;
  let index = start;

  for (let i = start + 1; i < end; i += 1) {
    const distance = perpendicularDistanceMeters(track[i], track[start], track[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= toleranceMeters) return;

  keep[index] = true;
  markSimplifiedPoints(track, keep, start, index, toleranceMeters);
  markSimplifiedPoints(track, keep, index, end, toleranceMeters);
};

const chunkTrack = (track) => {
  if (track.length <= MAX_POINTS_PER_REQUEST) return [track];

  const chunks = [];
  const step = Math.max(MAX_POINTS_PER_REQUEST - REQUEST_OVERLAP, 1);

  for (let start = 0; start < track.length; start += step) {
    const end = Math.min(start + MAX_POINTS_PER_REQUEST, track.length);
    const chunk = track.slice(start, end);
    if (chunk.length >= 2) chunks.push(chunk);
    if (end === track.length) break;
  }

  return chunks;
};

const appendChunk = (target, chunk) => {
  const source = target.length ? chunk.slice(1) : chunk;
  target.push(...source);
};

const profileForProvider = (provider, requestedProfile) => {
  const configured = requestedProfile || process.env.MAP_MATCHING_PROFILE || "driving";
  return PROFILE_ALIASES[provider]?.[configured] || configured;
};

const radiusForPoint = (point) => {
  return Math.max(
    MIN_DISTANCE_METERS,
    Math.min(point.accuracy || MAX_ACCEPTED_ACCURACY_METERS, MAX_ACCEPTED_ACCURACY_METERS),
  );
};

const pointFromMatchedCoordinate = (lat, lng, chunk, index, length, source) => {
  const timestamp = interpolateTimestamp(chunk, index, length);
  const rawPoint = nearestPointByProgress(chunk, index, length);

  return {
    lat: Number(lat),
    lng: Number(lng),
    timestamp,
    accuracy: rawPoint?.accuracy ?? null,
    speed: rawPoint?.speed ?? null,
    moving: rawPoint?.moving ?? true,
    paused: rawPoint?.paused ?? false,
    rawIndex: rawPoint?.rawIndex ?? null,
    source,
  };
};

const nearestPointByProgress = (chunk, index, length) => {
  if (!chunk.length) return null;
  const position = length <= 1 ? 0 : index / (length - 1);
  const rawIndex = Math.round(position * (chunk.length - 1));
  return chunk[Math.min(Math.max(rawIndex, 0), chunk.length - 1)];
};

const interpolateTimestamps = (track, targetLength) => {
  return Array.from({ length: targetLength }, (_, index) =>
    interpolateTimestamp(track, index, targetLength),
  );
};

const interpolateTimestamp = (track, index, targetLength) => {
  if (!track.length) return Date.now();
  if (track.length === 1 || targetLength <= 1) return track[0].timestamp;

  const start = track[0].timestamp;
  const end = track[track.length - 1].timestamp;
  const ratio = index / (targetLength - 1);

  return Math.round(start + (end - start) * ratio);
};

const extractValhallaShape = (data) => {
  const encodedShape = data?.trip?.legs?.[0]?.shape || data?.shape;
  if (typeof encodedShape === "string") return decodePolyline(encodedShape, 6);

  const shape = data?.shape || data?.trip?.legs?.[0]?.shape;
  if (Array.isArray(shape)) {
    return shape
      .map((point) => ({
        lat: Number(point.lat ?? point.latitude),
        lng: Number(point.lon ?? point.lng ?? point.longitude),
      }))
      .filter((point) => isValidCoordinate(point.lat, point.lng));
  }

  return [];
};

const decodePolyline = (encoded, precision = 5) => {
  const points = [];
  const factor = 10 ** precision;
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const latResult = decodePolylineValue(encoded, index);
    index = latResult.index;
    lat += latResult.value;

    const lngResult = decodePolylineValue(encoded, index);
    index = lngResult.index;
    lng += lngResult.value;

    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
};

const decodePolylineValue = (encoded, startIndex) => {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = null;

  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    index,
  };
};

const perpendicularDistanceMeters = (point, start, end) => {
  const originLat = degreesToRadians(start.lat);
  const p = toMeters(point, originLat);
  const a = toMeters(start, originLat);
  const b = toMeters(end, originLat);
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)),
  );

  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const toMeters = (point, originLat) => {
  const earthRadius = 6371000;
  return {
    x: earthRadius * degreesToRadians(point.lng) * Math.cos(originLat),
    y: earthRadius * degreesToRadians(point.lat),
  };
};

const distanceMeters = (a, b) => {
  const earthRadius = 6371000;
  const dLat = degreesToRadians(b.lat - a.lat);
  const dLng = degreesToRadians(b.lng - a.lng);
  const lat1 = degreesToRadians(a.lat);
  const lat2 = degreesToRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

const fetchWithTimeout = async (url, timeoutMs, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const strictlyIncreasingTimestamps = (track) => {
  const timestamps = [];
  let last = 0;

  for (const point of track) {
    let next = Math.floor(point.timestamp / 1000);
    if (next <= last) next = last + 1;
    timestamps.push(next);
    last = next;
  }

  return timestamps;
};

const toTimestamp = (value, fallbackIndex = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : Date.now() + fallbackIndex * 1000;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toOptionalNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidCoordinate = (lat, lng) => {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (lat !== 0 || lng !== 0)
  );
};

const degreesToRadians = (value) => value * Math.PI / 180;
