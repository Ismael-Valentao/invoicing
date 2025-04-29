const express = require('express');
const router = express.Router();

const company = require('../models/company');

exports.createCompany = async (req, res) => {
    try {
        const { name, address, contact, email, nuit} = req.body;
        if (!name || !address || !contact || !email || !nuit) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const existingCompany = await company.find({ name });
        if (existingCompany.length > 0) {
            return res.status(400).json({ message: 'Company already exists' });
        }

        const newCompany = new company(req.body);
        await newCompany.save();
        res.status(201).json({ message: 'Company created successfully', company: newCompany });
    } catch (error) {
        res.status(500).json({ message: 'Error creating company', error });
    }
}

exports.getCompanies = async (req, res) => {
    try {
        const companies = await company.find();
        res.status(200).json({ companies });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching companies', error });
    }
}

exports.getCompanyById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyData = await company.findById(id);
        if (!companyData) {
            return res.status(404).json({ message: 'Company not found' });
        }
        res.status(200).json({ company: companyData });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching company', error });
    }
}

exports.updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedCompany = await company.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedCompany) {
            return res.status(404).json({ message: 'Company not found' });
        }
        res.status(200).json({ message: 'Company updated successfully', company: updatedCompany });
    } catch (error) {
        res.status(500).json({ message: 'Error updating company', error });
    }
}

exports.deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCompany = await company.findByIdAndDelete(id);
        if (!deletedCompany) {
            return res.status(404).json({ message: 'Company not found' });
        }
        res.status(200).json({ message: 'Company deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting company', error });
    }
}

