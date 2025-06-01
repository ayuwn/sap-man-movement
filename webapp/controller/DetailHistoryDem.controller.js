sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ushell/services/UserInfo"
], function (BaseController, formatter, JSONModel, MessageBox, Filter, FilterOperator, Fragment, UserInfo) {
    "use strict";

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailHistoryDem", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailHistoryDemotionModel = new JSONModel();
            this.getView().setModel(this._oDetailHistoryDemotionModel, "HistoryDemotion");
            this.getRouter().getRoute("detailhistorydem").attachPatternMatched(this._onDetailHistoryDemotionRouteMatched, this);

            const oDropdownModel = new sap.ui.model.json.JSONModel({
                asColl: [
                    { key: "1", text: "Baru" },
                    { key: "2", text: "Pengganti" }
                ],
                salaryAdjColl : [
                    { key: "1", text: "Ya"},
                    { key: "2", text: "Tidak"}
                ]
            });
            this.getView().setModel(oDropdownModel, "dropdown");
        },

        _onDetailHistoryDemotionRouteMatched: function (oEvent) {
            var sRequestId = oEvent.getParameter("arguments").RequestId;
            if (this._isValidGuid(sRequestId)) {
                this._getDetailHistoryDemotionData(sRequestId);
                this.loadSubmittedDocuments(sRequestId);
                this.loadApprovalHistoryWithRequestor(sRequestId);
            } else {
                console.error("Invalid Request ID format");
                MessageBox.error("Invalid Request ID format");
            }
        },

        _isValidGuid: function (sGuid) {
            var guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            return guidRegex.test(sGuid);
        },

        _getDetailHistoryDemotionData: function (sRequestId) {
            var that = this;
            var oModel = this.getView().getModel("Demotion");
            this._oBusy.open();
            
            // Retrieve data from RequestSet for the specific request
            oModel.read(`/RequestSet(guid'${sRequestId}')`, {
                success: function (oRequestData) {
                    console.log("RequestSet data retrieved successfully:", oRequestData);
        
                    // Retrieve data from EmployeeDetailSet for the specific employee
                    var sEmployeeNumber = oRequestData.EmployeeNumber;
                    oModel.read(`/EmployeeDetailSet('${sEmployeeNumber}')`, {
                        success: function (oEmployeeData) {
                            console.log("EmployeeDetailSet data retrieved successfully:", oEmployeeData);
        
                            // Combine data from RequestSet and EmployeeDetailSet
                            var oCombinedData = Object.assign({}, oRequestData, oEmployeeData);
        
                            // Set the combined data in the DetailHistoryModel
                            that._oDetailHistoryDemotionModel.setData(oCombinedData);
                            that._oBusy.close();
                        },
                        error: function (oError) {
                            console.error("Error retrieving EmployeeDetailSet data:", oError);
                            MessageBox.error("Failed to load employee data");
                            that._oBusy.close();
                        }
                    });
                },
                error: function (oError) {
                    console.error("Error retrieving RequestSet data:", oError);
                    MessageBox.error("Failed to load request data");
                    that._oBusy.close();
                }
            });
        },

        loadApprovalHistoryWithRequestor: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch approval history.");
                return;
            }

            const oModel = this.getOwnerComponent().getModel("Demotion"); 

            sap.ui.core.BusyIndicator.show(0);

            const sRequestPath = `/RequestSet(guid'${sRequestId}')`;
            const sToApprovalPath = `${sRequestPath}/toApproval`;

            oModel.read(sRequestPath, {
                success: function (oRequestData) {
                    // Get requestor info
                    const sEmployeePath = `/EmployeeDetailSet('${oRequestData.PicNumber}')`;
                    oModel.read(sEmployeePath, {
                        success: function (oEmployeeData) {
                            const sFormattedName = oEmployeeData.EmployeeName?.FormattedName || oEmployeeData.EmployeeName || "Unknown";
                            const oRequestorEntry = {
                                ApproverId: oRequestData.PicNumber,
                                ApproverName: sFormattedName,
                                ApprovalDate: oRequestData.CreatedOn,
                                ApprovalTime: oRequestData.CreatedAt,
                                Status: "Submitted",
                                StatusText: "Submitted",
                                Notes: ""
                            };

                            oModel.read(sToApprovalPath, {
                                success: function (oApprovalData) {
                                    const aApprovalHistory = [oRequestorEntry].concat(oApprovalData.results || []);
                                    const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: aApprovalHistory });
                                    const oTable = this.getView().byId("idApprTable");
                                    if (oTable) {
                                        oTable.setModel(oApprovalHistoryModel, "appr");
                                    }
                                    sap.ui.core.BusyIndicator.hide();
                                }.bind(this),
                                error: function () {
                                    // Only requestor entry if approval data fails
                                    const oApprovalHistoryModel = new sap.ui.model.json.JSONModel({ results: [oRequestorEntry] });
                                    const oTable = this.getView().byId("idApprTable");
                                    if (oTable) {
                                        oTable.setModel(oApprovalHistoryModel, "appr");
                                    }
                                    sap.ui.core.BusyIndicator.hide();
                                }.bind(this)
                            });
                        }.bind(this),
                        error: function () {
                            MessageBox.error("Failed to load employee data for approval history.");
                            sap.ui.core.BusyIndicator.hide();
                        }
                    });
                }.bind(this),
                error: function () {
                    MessageBox.error("Failed to load request data for approval history.");
                    sap.ui.core.BusyIndicator.hide();
                }
            });
        },

        loadSubmittedDocuments: function (sRequestId) {
            if (!sRequestId) {
                MessageBox.error("No request ID found. Cannot fetch documents.");
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel("Demotion");
            const oView = this.getView();
        
            // Construct the path for FileAttachmentViewSet
            const sPath = `/FileAttachmentViewSet`;
        
            // Define filters for the RequestId
            const aFilters = [
                new sap.ui.model.Filter("Reqid", sap.ui.model.FilterOperator.EQ, sRequestId)
            ];
        
            // Fetch documents from FileAttachmentViewSet
            oModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {
                    console.log("Documents fetched successfully from FileAttachmentViewSet:", oData.results);
        
                    // Bind the data to the fileAttachment model
                    const oFileAttachmentModel = new sap.ui.model.json.JSONModel({ results: oData.results });
                    oView.setModel(oFileAttachmentModel, "fileAttachmentView");
                },
                error: function (oError) {
                    console.error("Error fetching documents from FileAttachmentViewSet:", oError);
                    MessageBox.error("Failed to fetch submitted documents.");
                }
            });
        },

        onShowDocument: function (oEvent) {
            // Get the binding context of the button
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("fileAttachmentView");
        
            // Get the URL from the binding context
            const sUrl = oContext.getProperty("Url");
        
            // Open the URL in a new tab
            if (sUrl) {
                window.open(sUrl, "_blank");
            } else {
                sap.m.MessageToast.show("No URL available for this document.");
            }
        },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
                oRouter.navTo("history", {}, true);
            }
        }

    });
});