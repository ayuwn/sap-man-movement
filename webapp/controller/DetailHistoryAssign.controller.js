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

    return BaseController.extend("bsim.hcmapp.man.movement.controller.DetailHistoryAssign", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this._oDetailHistoryAssignmentModel = new JSONModel();
            this.getView().setModel(this._oDetailHistoryAssignmentModel, "HistoryAssignment");
            this.getRouter().getRoute("detailhistoryassign").attachPatternMatched(this._onDetailHistoryAssignmentRouteMatched, this);

            let oEmployeeModel = new JSONModel({

            });
            this.getView().setModel(oEmployeeModel, "employee");

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

            // Set the Grievances OData model
            const oGrievancesModel = this.getOwnerComponent().getModel("Grievances");
            if (!oGrievancesModel) {
                console.error("Grievances model is not available.");
                return;
            }

            oGrievancesModel.read("/RequestSet", {
                urlParameters: {
                    "$expand": "toAttachmentView", // Expand toAttachmentView
                    "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
                },
                success: (oData) => {
                    console.log("Grievances data with attachments loaded successfully:", oData);
            
                    const aRequests = oData.results || [];
                    const sEmployeeNumber = this.getView().getModel("employee").getProperty("/EmployeeNumber");
            
                    if (!sEmployeeNumber) {
                        console.error("Employee number is missing in the 'employee' model.");
                        // sap.m.MessageBox.error("Employee number is missing. Cannot fetch document.");
                        return;
                    }
            
                    const aFilteredRequests = aRequests.filter(request => request.EmployeeNumber === sEmployeeNumber);
            
                    if (aFilteredRequests.length === 0) {
                        console.warn(`No requests found for EmployeeNumber: ${sEmployeeNumber}`);
                        // Set hasRequest to false and hide the button
                        const oAttachmentModel = new sap.ui.model.json.JSONModel({ hasRequest: false });
                        this.getView().setModel(oAttachmentModel, "FilteredAttachments");
                        return;
                    }
            
                    const oLatestRequest = aFilteredRequests[0]; // The first request is the newest due to sorting
                    console.log("Most recent request:", oLatestRequest);
            
                    // Process attachments from the newest request
                    const aAttachments = oLatestRequest.toAttachmentView?.results || [];
                    const aFilteredAttachments = aAttachments.filter(attachment => attachment.TypeDoc === "ST/SP Baru");
            
                    const oAttachmentModel = new sap.ui.model.json.JSONModel({
                        hasRequest: aFilteredAttachments.length > 0,
                        attachments: aFilteredAttachments
                    });
                    this.getView().setModel(oAttachmentModel, "FilteredAttachments");
            
                    if (aFilteredAttachments.length > 0) {
                        console.log("Filtered Attachments with TypeDoc 'ST/SP Baru':", aFilteredAttachments);
                    } else {
                        console.warn("No attachments with TypeDoc 'ST/SP Baru' found.");
                    }
                },
                error: (oError) => {
                    console.error("Error loading grievances data with attachments:", oError);
                    const oAttachmentModel = new sap.ui.model.json.JSONModel({ hasRequest: false });
                    this.getView().setModel(oAttachmentModel, "FilteredAttachments");
                }
            });
        },

        _onDetailHistoryAssignmentRouteMatched: function (oEvent) {
            var sRequestId = oEvent.getParameter("arguments").RequestId;
            if (this._isValidGuid(sRequestId)) {
                this._getDetailHistoryAssignmentData(sRequestId);
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

        _getDetailHistoryAssignmentData: function (sRequestId) {
            var that = this;
            var oModel = this.getView().getModel("Assignment");
            this._oBusy.open();

            oModel.read(`/RequestSet(guid'${sRequestId}')`, {
                success: function (oRequestData) {
                    var sEmployeeNumber = oRequestData.EmployeeNumber;
                    // Set employee number in the employee model
                    var oEmployeeModel = that.getView().getModel("employee");
                    if (oEmployeeModel) {
                        oEmployeeModel.setProperty("/EmployeeNumber", sEmployeeNumber);
                    } else {
                        oEmployeeModel = new sap.ui.model.json.JSONModel({ EmployeeNumber: sEmployeeNumber });
                        that.getView().setModel(oEmployeeModel, "employee");
                    }

                    oModel.read(`/EmployeeDetailSet('${sEmployeeNumber}')`, {
                        success: function (oEmployeeData) {
                            var oCombinedData = Object.assign({}, oEmployeeData, oRequestData);
                            that._oDetailHistoryAssignmentModel.setData(oCombinedData);
                            that._oBusy.close();
                        },
                        error: function (oError) {
                            MessageBox.error("Failed to load employee data");
                            that._oBusy.close();
                        }
                    });
                },
                error: function (oError) {
                    MessageBox.error("Failed to load request data");
                    that._oBusy.close();
                }
            });
        },

        _getEmployeeData: function (EmployeeNumber) {
            return new Promise((resolve, reject) => {
                // Define paths for EmployeeSet and EmployeeDetailSet
                const sEmployeePath = `/EmployeeSet('${EmployeeNumber}')`;
                const sEmployeeDetailPath = `/EmployeeDetailSet('${EmployeeNumber}')`;
        
                let oEmployeeModel = this.getView().getModel("employee");
                let oEmployeeDetailModel = this.getView().getModel("employeeDetail");
        
                this._oBusy.open();
        
                // Fetch EmployeeSet data
                this.readEntity(sEmployeePath)
                    .then((employeeResult) => {
                        if (!employeeResult) {
                            MessageBox.error(this.getResourceBundle().getText("msgNotAuthorized"), {
                                actions: ["Exit"],
                                onClose: (sAction) => {
                                    this._navBack();
                                },
                            });
                            return Promise.reject("No EmployeeSet data found.");
                        }
        
                        // Set EmployeeSet data to the model
                        oEmployeeModel.setData(employeeResult);
                        console.log("EmployeeSet Data loaded:", employeeResult);
        
                        // Fetch EmployeeDetailSet data
                        return this.readEntity(sEmployeeDetailPath);
                    })
                    .then((employeeDetailResult) => {
                        if (employeeDetailResult) {
                            // Set EmployeeDetailSet data to the model
                            if (!oEmployeeDetailModel) {
                                oEmployeeDetailModel = new sap.ui.model.json.JSONModel();
                                this.getView().setModel(oEmployeeDetailModel, "employeeDetail");
                            }
                            oEmployeeDetailModel.setData(employeeDetailResult);
                            console.log("EmployeeDetailSet Data loaded:", employeeDetailResult);
                        } else {
                            console.warn("EmployeeDetailSet data is missing.");
                        }
                        resolve(); // Resolve the Promise after successful data loading
                    })
                    .catch((error) => {
                        console.error("Error loading employee data:", error);
                        MessageBox.error("Error loading employee details");
                        reject(error); // Reject the Promise in case of an error
                    })
                    .finally(() => {
                        this._oBusy.close();
                    });
            });
        },

        loadSubmittedDocuments: function (sRequestId) {
            if (!sRequestId) {
                MessageBox.error("No request ID found. Cannot fetch documents.");
                return;
            }
        
            const oModel = this.getOwnerComponent().getModel("Assignment");
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

        onDisplayDocumentWarning: function () {
            const oEmployeeModel = this.getView().getModel("employee");
            const sEmployeeNumber = oEmployeeModel ? oEmployeeModel.getProperty("/EmployeeNumber") : null;
        
            if (!sEmployeeNumber) {
                console.error("Employee number is missing in the 'employee' model.");
                sap.m.MessageBox.error("Employee number is missing. Cannot fetch document.");
                return;
            }
        
            console.log("Fetching requests for EmployeeNumber:", sEmployeeNumber);
        
            const oModel = this.getOwnerComponent().getModel("Grievances");
            if (!oModel) {
                console.error("Grievances model is not available.");
                sap.m.MessageBox.error("System error: Grievances model is not available.");
                return;
            }
        
            oModel.read("/RequestSet", {
                filters: [new sap.ui.model.Filter("EmployeeNumber", sap.ui.model.FilterOperator.EQ, sEmployeeNumber)],
                urlParameters: {
                    "$orderby": "CreatedOn desc, CreatedAt desc" // Sort by CreatedOn and CreatedAt descending
                },
                success: (oData) => {
                    console.log("Requests fetched successfully:", oData);
        
                    const aRequests = oData.results || [];
                    const aFilteredRequests = aRequests.filter(request => request.EmployeeNumber === sEmployeeNumber);
        
                    if (aFilteredRequests.length === 0) {
                        console.warn(`No requests found for EmployeeNumber: ${sEmployeeNumber}`);
                        sap.m.MessageBox.error(`No requests found for EmployeeNumber: ${sEmployeeNumber}`);
                        return;
                    }
        
                    const oLatestRequest = aFilteredRequests[0]; // The first request is the newest due to sorting
                    console.log("Most recent request:", oLatestRequest);
        
                    const sExpandPath = `/RequestSet(guid'${oLatestRequest.RequestId}')/toAttachmentView`;
                    console.log("Expanding to path:", sExpandPath);
        
                    oModel.read(sExpandPath, {
                        success: (oAttachmentData) => {
                            console.log("Attachments fetched successfully:", oAttachmentData);
        
                            if (!oAttachmentData.results || oAttachmentData.results.length === 0) {
                                console.warn("No attachments found for the latest request.");
                                sap.m.MessageBox.error("No attachments found for the latest request.");
                                return;
                            }
        
                            const oSelectedAttachment = oAttachmentData.results.reduce((highest, current) => {
                                return current.SequenceNo > highest.SequenceNo ? current : highest;
                            });
        
                            console.log("Selected attachment with highest SequenceNo:", oSelectedAttachment);
        
                            if (!oSelectedAttachment || !oSelectedAttachment.Url) {
                                console.warn("No valid document URL found in the attachments.");
                                sap.m.MessageBox.error("No valid document URL found in the attachments.");
                                return;
                            }
        
                            const sDocumentUrl = oSelectedAttachment.Url;
                            console.log("Opening document URL:", sDocumentUrl);
                            window.open(sDocumentUrl, "_blank");
                        },
                        error: (oError) => {
                            console.error("Error fetching attachments:", oError);
                            sap.m.MessageBox.error("Failed to fetch attachments for the latest request.");
                        }
                    });
                },
                error: (oError) => {
                    console.error("Error fetching requests:", oError);
                    sap.m.MessageBox.error("Failed to fetch requests for the given employee.");
                }
            });
        },

        loadApprovalHistoryWithRequestor: function (sRequestId) {
            if (!sRequestId || !this._isValidGuid(sRequestId)) {
                MessageBox.error("Invalid Request ID format. Cannot fetch approval history.");
                return;
            }

            const oModel = this.getOwnerComponent().getModel("Assignment"); 

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