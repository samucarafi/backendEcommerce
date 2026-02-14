import loggiPlatform from "@api/loggi-platform";

loggiPlatform
  .authenticateV2()
  .then(({ data }) => console.log(data))
  .catch((err) => console.error(err));
