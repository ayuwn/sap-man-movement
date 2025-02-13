sap.ui.define([
	"sap/ui/core/mvc/Controller"
],
	// eslint-disable-next-line valid-jsdoc
	/**
	 * @param {typeof sap.ui.core.mvc.Controller} C 
	 */
	function (C) {
		"use strict";
		return C.extend("bsim.hcmapp.man.movement.controller.BaseController", {
			getRouter: function () {
				return sap.ui.core.UIComponent.getRouterFor(this);
			},

			getModel: function (n) {
				return this.getView().getModel(n);
			},

			setModel: function (m, n) {
				return this.getView().setModel(m, n);
			},

			getResourceBundle: function () {
				return this.getOwnerComponent().getModel("i18n").getResourceBundle();
			},

			// untuk ambil data dari oData
			readEntity: function (sPath, sXp, aFilter) {
				return new Promise((resolved, rejected) => {
					this.getOwnerComponent().getModel().read(sPath, {
						async: false,
						urlParameters: {
							$expand: sXp
						},
						filters: aFilter,
						success: (oData) => {
							resolved(oData);
						},
						error: (oError) => {
							if (oError) {
								if (oError.responseText) {
									if (oError.statusCode === 500) {
										rejected("In the context of Data Services an unknown internal server error occurred");
									} else {
										var oErrorMessage = JSON.parse(oError.responseText);
										rejected("Error: " + oErrorMessage.error.message.value);
									}
								}
							}
						}
					})
				})
			},

			formatDateUtc: function (d, m = false) {
				if (d) {
					let oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
						pattern: "yyyy-MM-ddTHH:mm:ss"
					}),
						dateVal = new Date(oDateFormat.format(d));
					if (!m) {
						dateVal.setMinutes(dateVal.getTimezoneOffset() * -1);
					} else {
						dateVal.setMinutes(dateVal.getTimezoneOffset() * 1);
					}
					return dateVal;
				} else {
					return "1970-01-01T12:00:00";
				}
			},

			parseGuid: function (g) {
				const lengths = [8, 4, 4, 4, 12];
				let range = 0,
					parts = [];
				for (let i = 0; i < lengths.length; i++) {
					parts.push(g.slice(range, range + lengths[i]));
					range += lengths[i];
				}
				return parts.join("-");
			}
		});
	});