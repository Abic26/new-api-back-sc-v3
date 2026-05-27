const getBossEmailByUserName = (userName = "") => {
  const normalizedName = userName.toLowerCase().trim();

  // modificar los correos por comercial, bogota juan y barranquilla nicolas
  const bossGroups = {
    "abicdev26@gmail.com": ["abic", "admin admin"],

    "abicsupa@gmail.com": [
      "jefe logistica",
      "comercial jd",
      "logistica",
    ],
  };

  for (const [bossEmail, users] of Object.entries(bossGroups)) {
    if (users.includes(normalizedName)) {
      return bossEmail;
    }
  }

  return null;
};

export default getBossEmailByUserName