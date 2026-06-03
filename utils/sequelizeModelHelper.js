const { Op } = require('sequelize');

/**
 * Translates MongoDB/Mongoose query operators ($regex, $or, $in, _id)
 * into Sequelize-compatible Op operators.
 */
function parseMongooseQuery(query) {
  if (!query || typeof query !== 'object') return query;

  const parsed = {};
  for (const [key, value] of Object.entries(query)) {
    // Remap MongoDB _id to SQL id
    const targetKey = key === '_id' ? 'id' : key;

    if (key === '$or') {
      parsed[Op.or] = value.map(q => parseMongooseQuery(q));
    } else if (key === '$and') {
      parsed[Op.and] = value.map(q => parseMongooseQuery(q));
    } else if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      const fieldQuery = {};
      let hasOp = false;
      for (const [op, val] of Object.entries(value)) {
        if (op === '$regex') {
          fieldQuery[Op.like] = `%${val}%`;
          hasOp = true;
        } else if (op === '$options') {
          // Skip — MySQL LIKE is case-insensitive by default
          continue;
        } else if (op === '$in') {
          fieldQuery[Op.in] = val;
          hasOp = true;
        } else if (op === '$nin') {
          fieldQuery[Op.notIn] = val;
          hasOp = true;
        } else if (op === '$gt') {
          fieldQuery[Op.gt] = val;
          hasOp = true;
        } else if (op === '$gte') {
          fieldQuery[Op.gte] = val;
          hasOp = true;
        } else if (op === '$lt') {
          fieldQuery[Op.lt] = val;
          hasOp = true;
        } else if (op === '$lte') {
          fieldQuery[Op.lte] = val;
          hasOp = true;
        } else if (op === '$ne') {
          fieldQuery[Op.ne] = val;
          hasOp = true;
        }
      }
      // If recognized Mongo ops were found, use the translated fieldQuery
      // Otherwise, assign the plain value directly (do NOT recurse — that caused infinite loops)
      parsed[targetKey] = hasOp ? fieldQuery : value;
    } else {
      parsed[targetKey] = value;
    }
  }
  return parsed;
}

/**
 * Chainable wrapper for multi-record queries (Model.find).
 * Supports: select(), populate(), sort(), skip(), limit()
 * Uses a captured reference to the original Sequelize findAll to avoid recursion.
 */
class MultiThenableQuery {
  constructor(model, query, originalFindAll) {
    this.model = model;
    this._originalFindAll = originalFindAll;
    this.options = {
      where: parseMongooseQuery(query)
    };
  }

  select(fields) {
    if (typeof fields === 'string') {
      this.options.attributes = fields.startsWith('-')
        ? { exclude: [fields.substring(1)] }
        : fields.split(' ');
    }
    return this;
  }

  populate(association, fields) {
    const targetAssoc = association === 'customer' ? 'customerAssociation' : association;
    const includeOpt = { association: targetAssoc };
    if (fields && typeof fields === 'string') {
      includeOpt.attributes = fields.split(' ');
    }
    if (!this.options.include) this.options.include = [];
    this.options.include.push(includeOpt);
    return this;
  }

  sort(sortObj) {
    if (!sortObj) return this;
    if (typeof sortObj === 'object') {
      this.options.order = Object.entries(sortObj).map(([key, val]) => [key, val === -1 ? 'DESC' : 'ASC']);
    } else if (typeof sortObj === 'string') {
      const desc = sortObj.startsWith('-');
      const field = desc ? sortObj.substring(1) : sortObj;
      this.options.order = [[field, desc ? 'DESC' : 'ASC']];
    }
    return this;
  }

  skip(offsetNum) {
    this.options.offset = parseInt(offsetNum, 10);
    return this;
  }

  limit(limitNum) {
    this.options.limit = parseInt(limitNum, 10);
    return this;
  }

  // Use the saved original Sequelize findAll — NOT the overridden Model.find
  then(onFulfilled, onRejected) {
    return this._originalFindAll(this.options).then(onFulfilled, onRejected);
  }
}

/**
 * Chainable wrapper for single-record queries (Model.findOne, Model.findById).
 * Uses captured references to original Sequelize methods to avoid infinite recursion.
 */
class SingleThenableQuery {
  /**
   * @param {Model} model - The Sequelize model class
   * @param {string} finderMethod - 'findByPk' or 'findOne'
   * @param {*} arg - PK value (for findByPk) or query object (for findOne)
   * @param {Function} originalFindOne - Original Sequelize findOne before override
   */
  constructor(model, finderMethod, arg, originalFindOne) {
    this.model = model;
    this.finderMethod = finderMethod;
    this.arg = arg;
    this._originalFindOne = originalFindOne;
    this.options = {};
  }

  select(fields) {
    if (typeof fields === 'string') {
      this.options.attributes = fields.startsWith('-')
        ? { exclude: [fields.substring(1)] }
        : fields.split(' ');
    }
    return this;
  }

  populate(association, fields) {
    const targetAssoc = association === 'customer' ? 'customerAssociation' : association;
    const includeOpt = { association: targetAssoc };
    if (fields && typeof fields === 'string') {
      includeOpt.attributes = fields.split(' ');
    }
    if (!this.options.include) this.options.include = [];
    this.options.include.push(includeOpt);
    return this;
  }

  then(onFulfilled, onRejected) {
    // IMPORTANT: Always use seqFindOne (original Sequelize findOne) for both findByPk
    // and findOne cases. We cannot use Sequelize's findByPk because it internally calls
    // this.findOne — which we've overridden — causing double-nested WHERE and crash.
    // seqFindOne calls findAll internally which is safe (we don't override findAll).
    let whereClause;
    if (this.finderMethod === 'findByPk') {
      whereClause = { id: this.arg };
    } else {
      whereClause = parseMongooseQuery(this.arg);
    }
    const promise = this._originalFindOne({ where: whereClause, ...this.options });
    return promise.then(onFulfilled, onRejected);
  }
}

/**
 * Applies Mongoose-style static and instance methods to a Sequelize model class.
 * IMPORTANT: Original Sequelize methods are captured BEFORE overwriting to prevent
 * infinite recursion in the thenable query wrappers.
 */
function applyMongooseCompat(modelClass) {
  // ── Capture original Sequelize statics BEFORE overwriting ──────────────────
  // NOTE: We only need findOne and findAll. Do NOT capture findByPk because
  // Sequelize's findByPk internally calls this.findOne — which we override —
  // causing infinite recursion. We emulate findByPk via findOne with WHERE id=pk.
  const seqFindOne = modelClass.findOne.bind(modelClass);
  const seqFindAll = modelClass.findAll.bind(modelClass);

  // ── Mongoose-style Static Methods ──────────────────────────────────────────

  modelClass.find = function (query) {
    return new MultiThenableQuery(this, query, seqFindAll);
  };

  modelClass.findOne = function (query) {
    return new SingleThenableQuery(this, 'findOne', query, seqFindOne);
  };

  modelClass.findById = function (id) {
    return new SingleThenableQuery(this, 'findByPk', id, seqFindOne);
  };

  modelClass.findByIdAndUpdate = async function (id, data) {
    await this.update(data, { where: { id }, individualHooks: true });
    // Use seqFindOne to find updated record — safe since it calls findAll internally
    return seqFindOne({ where: { id } });
  };

  modelClass.countDocuments = function (query) {
    return this.count({ where: parseMongooseQuery(query) });
  };

  modelClass.deleteMany = function (query = {}) {
    return this.destroy({ where: parseMongooseQuery(query) });
  };

  const originalCreate = modelClass.create;
  const originalBulkCreate = modelClass.bulkCreate;
  
  const mapData = (item) => {
    if (!item) return item;
    const mapped = { ...item };
    if (mapped.customer !== undefined) {
      mapped.customerId = mapped.customer;
      delete mapped.customer;
    }
    return mapped;
  };

  modelClass.create = async function (data, options) {
    if (Array.isArray(data)) {
      const results = [];
      for (const item of data) {
        results.push(await originalCreate.call(this, mapData(item), options));
      }
      return results;
    }
    return originalCreate.call(this, mapData(data), options);
  };

  // ── Mongoose-style Instance Methods & Property Aliases ─────────────────────

  // _id → id alias
  Object.defineProperty(modelClass.prototype, '_id', {
    get() { return this.id; },
    set(val) { this.id = val; },
    configurable: true
  });

  // customer virtual — reads from populated association or raw FK
  Object.defineProperty(modelClass.prototype, 'customer', {
    get() {
      return this.customerAssociation !== undefined
        ? this.customerAssociation
        : this.customerId;
    },
    set(val) {
      if (val && typeof val === 'object') {
        this.customerAssociation = val;
        this.customerId = val.id;
      } else {
        this.customerId = val;
      }
    },
    configurable: true
  });

  // deleteOne — maps to Sequelize destroy()
  modelClass.prototype.deleteOne = function () {
    return this.destroy();
  };

  // toObject — plain JS object
  modelClass.prototype.toObject = function () {
    return this.get({ plain: true });
  };

  // toJSON — adds _id alias and normalizes customer relation for frontend
  // Uses get({ plain: true }) to avoid the infinite recursion that occurs
  // when calling originalToJSON (which re-triggers toJSON on nested includes)
  modelClass.prototype.toJSON = function () {
    const values = this.get({ plain: true });
    values._id = values.id;

    // Only remap customerId -> customer if this is NOT the Customer model itself.
    // On Order/Payment, customerId is a foreign key. On Customer, it's the custom string ID.
    if (this.constructor.name !== 'Customer') {
      if (values.customerAssociation !== undefined) {
        values.customer = values.customerAssociation;
        delete values.customerAssociation;
        delete values.customerId;
      } else if (values.customerId !== undefined) {
        values.customer = values.customerId;
        delete values.customerAssociation;
        delete values.customerId;
      }
    }

    return values;
  };
}

module.exports = { applyMongooseCompat, parseMongooseQuery };
