const Category = require('../models/Category');
const ServiceArea = require('../models/ServiceArea');
const { success, error } = require('../utils/ApiResponse');

// Get Categories (public)
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();

    return success(res, 200, 'Categories retrieved', {
      categories,
      count: categories.length,
    });
  } catch (err) {
    console.error('Get categories error:', err);
    return error(res, 500, 'Error retrieving categories', 'GET_CATEGORIES_ERROR');
  }
};

// Create Category (super_admin)
const createCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;

    const existingCategory = await Category.findOne({ name: name.toLowerCase() });
    if (existingCategory) {
      return error(res, 409, 'Category already exists', 'CATEGORY_EXISTS');
    }

    const category = new Category({
      name,
      icon: icon || '📦',
      isActive: true,
    });

    await category.save();

    return success(res, 201, 'Category created', category);
  } catch (err) {
    console.error('Create category error:', err);
    return error(res, 500, 'Error creating category', 'CREATE_CATEGORY_ERROR');
  }
};

// Update Category (super_admin)
const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, icon, isActive } = req.body;

    const category = await Category.findById(categoryId);

    if (!category) {
      return error(res, 404, 'Category not found', 'NOT_FOUND');
    }

    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    return success(res, 200, 'Category updated', category);
  } catch (err) {
    console.error('Update category error:', err);
    return error(res, 500, 'Error updating category', 'UPDATE_CATEGORY_ERROR');
  }
};

// Delete Category (super_admin)
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);

    if (!category) {
      return error(res, 404, 'Category not found', 'NOT_FOUND');
    }

    await Category.deleteOne({ _id: categoryId });

    return success(res, 200, 'Category deleted', {});
  } catch (err) {
    console.error('Delete category error:', err);
    return error(res, 500, 'Error deleting category', 'DELETE_CATEGORY_ERROR');
  }
};

// Get Service Areas
const getServiceAreas = async (req, res) => {
  try {
    const areas = await ServiceArea.find().sort({ city: 1 }).lean();

    return success(res, 200, 'Service areas retrieved', {
      areas,
      count: areas.length,
    });
  } catch (err) {
    console.error('Get service areas error:', err);
    return error(res, 500, 'Error retrieving service areas', 'GET_AREAS_ERROR');
  }
};

// Create Service Area
const createServiceArea = async (req, res) => {
  try {
    const { city } = req.body;

    const existingArea = await ServiceArea.findOne({ city: city.toLowerCase() });
    if (existingArea) {
      return error(res, 409, 'Service area already exists', 'AREA_EXISTS');
    }

    const area = new ServiceArea({
      city,
      isActive: true,
    });

    await area.save();

    return success(res, 201, 'Service area created', area);
  } catch (err) {
    console.error('Create service area error:', err);
    return error(res, 500, 'Error creating service area', 'CREATE_AREA_ERROR');
  }
};

// Update Service Area
const updateServiceArea = async (req, res) => {
  try {
    const { areaId } = req.params;
    const { isActive } = req.body;

    const area = await ServiceArea.findByIdAndUpdate(
      areaId,
      { isActive },
      { new: true }
    );

    if (!area) {
      return error(res, 404, 'Service area not found', 'NOT_FOUND');
    }

    return success(res, 200, 'Service area updated', area);
  } catch (err) {
    console.error('Update service area error:', err);
    return error(res, 500, 'Error updating service area', 'UPDATE_AREA_ERROR');
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getServiceAreas,
  createServiceArea,
  updateServiceArea,
};
