import ShippingConfig from "./model.js";

// GET config
export const getShippingConfig = async (req, res) => {
  try {
    let config = await ShippingConfig.findOne();

    if (!config) {
      config = await ShippingConfig.create({
        shippingByState: {
          RJ: 12,
          SP: 18,
          MG: 17,
          ES: 19,

          PR: 28,
          SC: 30,
          RS: 32,

          BA: 35,
          SE: 37,
          AL: 38,
          PE: 39,
          PB: 40,
          RN: 42,
          CE: 43,
          PI: 41,
          MA: 44,

          GO: 29,
          DF: 31,
          MT: 34,
          MS: 33,
          TO: 36,

          PA: 45,
          AP: 48,
          AM: 50,
          RR: 55,
          RO: 47,
          AC: 52,
        },
        freeShippingMinValue: 0,
        extraDays: 0,
      });
    }

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE config (admin)
export const updateShippingConfig = async (req, res) => {
  try {
    const config = await ShippingConfig.findOne();

    if (!config)
      return res.status(404).json({ message: "Config não encontrada" });

    config.shippingByState = req.body.shippingByState;
    config.freeShippingMinValue = req.body.freeShippingMinValue;
    config.extraDays = req.body.extraDays;

    await config.save();

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
