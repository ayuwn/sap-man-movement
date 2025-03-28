sap.ui.define([
    "bsim/hcmapp/man/movement/controller/BaseController",
    "bsim/hcmapp/man/movement/utils/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/core/library"
], function (BaseController, formatter, JSONModel, MessageBox, MessageToast, Filter, FilterOperator, Fragment, CoreLib) {
    "use strict";
    var ValueState = CoreLib.ValueState;

    return BaseController.extend("bsim.hcmapp.man.movement.controller.Acting", {
        formatter: formatter,

        onInit: function () {
            this._oView = this.getView();
            this._oComponent = this.getOwnerComponent();
            this._oView.addStyleClass(this._oComponent.getContentDensityClass());
            this._oBusy = new sap.m.BusyDialog();
            this.getRouter().getRoute("acting").attachPatternMatched(this._onActingRouteMatched, this);

            let oDocUploadModel = new JSONModel({
                uploads: []
            });
            this.getView().setModel(oDocUploadModel, "docUploads");

            let oDropdownModel = new JSONModel({
                selectedPIC: "",
                selectedJenisDokumen: "",
                selectedSalaryAdj: "",
                selectedAs: "",

                jenisDokumenColl: [
                    { key: "1", text: "Evaluasi Karyawan" },
                    { key: "2", text: "PKWT Terakhir" },
                    { key: "3", text: "Assessment" },
                    { key: "4", text: "Hasil BI Checking" },
                    { key: "5", text: "Disposisi" },
                    { key: "6", text: "PKWT Baru" }
                ],
                PICColl: [
                    { key: "1", text: "Requestor" },
                    { key: "2", text: "Talent & Management" },
                    { key: "3", text: "Compensation & Benefit" },
                    { key: "4", text: "Data Management" },
                ],

                salaryAdjColl : [
                    { key: "1", text: "Ya"},
                    { key: "2", text: "Tidak"}
                ],

                asColl : [
                    { key: "1", text: "Baru"},
                    { key: "2", text: "Pengganti"}
                ]

            });
            this._oView.setModel(oDropdownModel, "dropdown");

            let oAssessmentActingModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oAssessmentActingModel, "assessmentActing");

            let oDisposisiActingModel = new JSONModel({
                selectedIndex: 0
            });
            this._oView.setModel(oDisposisiActingModel, "disposisiActing");
        },

        _onActingRouteMatched: function (oEvent) {
            const EmployeeNumber = oEvent.getParameter("arguments").EmployeeNumber;
            if (EmployeeNumber) {
                this._getEmployeeData(EmployeeNumber);
            }
        },

        _getEmployeeData: function (EmployeeNumber) {
            const sPath = `/EmployeeDetailSet('${EmployeeNumber}')`; // Path for specific employee
            
            let oEmployeeModel = new JSONModel();
            this.getView().setModel(oEmployeeModel, "employee");
            
            this._oBusy.open();
            
            const oModel = this.getOwnerComponent().getModel("Acting");
            oModel.read(sPath, {
                success: (oData) => {
                    oEmployeeModel.setData(oData);
                    console.log("Employee Data loaded:", oData);
                    this._oBusy.close();
                },
                error: (oError) => {
                    console.error("Error loading employee data:", oError);
                    this._oBusy.close();
                    MessageBox.error("Error loading employee details");
                }
            });
        },

        readEntity: function (sPath) {
            return new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
                oModel.read(sPath, {
                    success: (oData) => {
                        resolve(oData);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _validateEntries: function (oView, sGrpName) {
            let isValid = true;
            let aF = oView.getControlsByFieldGroupId(sGrpName);
        
            for (let i = 0; i < aF.length; i++) {
                try {
                    let oControl = aF[i];
        
                    // Only validate if control is editable (if supported)
                    if (typeof oControl.getEditable === "function" && !oControl.getEditable()) {
                        continue;
                    }
        
                    // Reset control state
                    if (typeof oControl.setValueStateText === "function") {
                        oControl.setValueStateText("");
                    }
                    if (typeof oControl.setValueState === "function") {
                        oControl.setValueState("None");
                    }
        
                    // Always use "This field" as the label
                    let sLabel = "This field";
        
                    // Determine if the field is required.
                    let bRequired = false;
                    if (typeof oControl.getRequired === "function") {
                        bRequired = oControl.getRequired();
                    }
        
                    // Determine if the control's value is empty
                    let isEmpty = false;
                    let sControlType = oControl.getMetadata().getName();
                    if (bRequired) {
                        if (sControlType === "sap.m.Select") {
                            isEmpty = !oControl.getSelectedKey();
                        } else if (typeof oControl.getValue === "function") {
                            let sValue = oControl.getValue();
                            isEmpty = !sValue || !sValue.trim();
                        }
                    }
        
                    // Set error state if required value is empty
                    if (bRequired && isEmpty) {
                        isValid = false;
                        if (typeof oControl.setValueStateText === "function") {
                            oControl.setValueStateText(sLabel + " is required!");
                        }
                        if (typeof oControl.setValueState === "function") {
                            oControl.setValueState("Error");
                        }
                    } else {
                        // Additional check for TextArea length
                        if (sControlType === "sap.m.TextArea" && typeof oControl.getValue === "function") {
                            let iMaxLength = oControl.getMaxLength();
                            let sValue = oControl.getValue();
                            if (iMaxLength && sValue.length > iMaxLength) {
                                isValid = false;
                                oControl.setValueStateText(sLabel + " is too long!");
                                oControl.setValueState("Error");
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Validation error for control:", e);
                    isValid = false;
                }
            }
        
            if (!isValid) {
                sap.m.MessageToast.show(this.getResourceBundle().getText("msgFillRequired"));
            }
        
            return isValid;
        },

        onOpenDialog: function () {
            var oView = this.getView();

            // Create dialog lazily
            if (!this._oDialog) {
                // Load and create fragment asynchronously
                Fragment.load({
                    id: oView.getId(),
                    name: "bsim.hcmapp.man.movement.view.fragments.DocumentUpload",
                    controller: this
                }).then(function (oDialog) {
                    this._oDialog = oDialog;
                    // Connect dialog to view's lifecycle management
                    oView.addDependent(this._oDialog);
                    this._oDialog.setModel(this.getView().getModel("dropdown"), "dropdown");
                    this._oDialog.open();
                }.bind(this));
            } else {
                this._oDialog.open();
            }
        },

        onDialogClose: function () {
            if (this._oDialog) {
                this._oDialog.close();
            }
        },

        onDialogSubmit: function () {
            let oView = this.getView();
            
            if (!this._oDialog) {
                console.error("Dialog belum dimuat.");
                return;
            }

            // Retrieve fragment controls using the fixed fragment ID ("documentUploadDialog")
            let oDocTypeSelect = Fragment.byId(oView.getId(), "docTypeSelect");
            let oPicSelect = Fragment.byId(oView.getId(), "picSelect");
            let oKeteranganInput = Fragment.byId(oView.getId(), "keteranganInput");
            let oFileUploader = Fragment.byId(oView.getId(), "fileUploader");

            if (!oDocTypeSelect || !oPicSelect || !oKeteranganInput || !oFileUploader) {
                console.error("Salah satu elemen dalam fragment tidak ditemukan.");
                return;
            }

            // Get selected document type key and text
            let sDocTypeKey   = oDocTypeSelect.getSelectedKey();
            let sDocTypeText  = oDocTypeSelect.getSelectedItem() ? oDocTypeSelect.getSelectedItem().getText() : "";
            // // Get selected PIC text from the picSelect control
            let sPICText      = oPicSelect.getSelectedItem() ? oPicSelect.getSelectedItem().getText() : "";
            // Get keterangan input and file uploader value
            let sKeterangan   = oKeteranganInput.getValue();
            let sFileValue    = oFileUploader.getValue();

            if (!sFileValue) {
                MessageBox.error("Dokumen harus diunggah.");
                return;
            }

            let sFileSize = oFileUploader.oFileUpload.files[0].size;
            let sFileName = sFileValue.split("\\").pop();
            let sFileType = sFileValue.split('.').pop().toLowerCase();

            // Validate file type
            if (sFileType !== "pdf") {
                MessageBox.error(this.getResourceBundle().getText("msgDocType"));
                return false;
            }

            // Check if document is blank
            if (!sFileValue) {
                MessageBox.error(this.getResourceBundle().getText("msgMissingDoc"));
                return false;
            }
            
            let sFileUrl      = "/uploads/" + + sFileName;
            
            // Prepare new document item
            let oNewDoc = {
                docType: sDocTypeKey,
                docTypeText: sDocTypeText,
                keterangan: sKeterangan,
                fileUrl: sFileUrl,
                fileSize: sFileSize,
                fileName: sFileName,
                pic: sPICText
            };

            let isValid = this._validateEntries(this._oDialog, "grpValidation");
            if (!isValid) {
                return false;
            }

            // Add new document to the "docUploads" model
            let oDocUploadModel = oView.getModel("docUploads");
            let aUploads = oDocUploadModel.getProperty("/uploads");
            aUploads.push(oNewDoc);
            oDocUploadModel.setProperty("/uploads", aUploads);
            
            // Clear fields then close dialog
            oDocTypeSelect.setSelectedKey("");
            oPicSelect.setSelectedKey("");
            oKeteranganInput.setValue("");
            oFileUploader.setValue("");
            this._oDialog.close();
        },

        handleLiveChange: function (oEvent) {
            var oTextArea = oEvent.getSource(),
                iValueLength = oTextArea.getValue().length,
                iMaxLength = oTextArea.getMaxLength(),
                sState = iValueLength > iMaxLength ? ValueState.Warning : ValueState.None;

            oTextArea.setValueState(sState);
        },

        onSendRequest: function() {
            // Get employee model
            let oEmployeeModel = this.getView().getModel("employee");
            let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");
          
            if (!oSelectedEmp) {
                MessageBox.error("Please select an employee first.");
                return;
            }
    
             // Validate required entries
             var oView = this.getView();
    
             // Validate required entries
             if (!this._validateEntries(oView, "grpValidation")) {
                return;
             }
            
            // Confirm with user before sending
            MessageBox.confirm("Do you want to submit this request?", {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                initialFocus: MessageBox.Action.NO,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.YES) {
                        this._postRequest();
                    } else {
                        return false;
                    }
                }
            });
        },

        _postRequest: function() {
            // Get employee data
            let oEmployeeModel = this.getView().getModel("employee");
            let oSelectedEmp = oEmployeeModel.getProperty("/EmployeeNumber");

            const getFormattedDate = (controlId) => {
                const control = this.byId(controlId);
                if (control && typeof control.getDateValue === "function") {
                    const dateValue = control.getDateValue();
                    return dateValue ? this.formatter.formatDateUtc(dateValue) : null;
                }
                return null;
            };

            const checkboxIds = ["hasilActing1", "hasilActing2", "hasilActing3", "hasilActing4", "hasilActing5"];
            let Zbichecking = checkboxIds
                .map(id => this.byId(id))
                .filter(checkbox => checkbox && checkbox.getSelected())
                .map(checkbox => checkbox.getText())
                .join(",");
        
            // Prepare the payload
            let oPayload = {
                RequestId: "00000000-0000-0000-0000-000000000000",
                EmployeeNumber: oSelectedEmp,
                Status: "S",  
                Massg: this.byId("reasonActing").getValue(),
                ZbegdaEfktf: getFormattedDate("effectiveDateStartActing"),
                ZenddaEfktf: getFormattedDate("effectiveDateEndActing"),
                PlansDest: this.byId("newPositionIdActing").getValue(),
                WerksDest: this.byId("newPerAreaIdActing").getValue(),
                BtrtlDest: this.byId("newPerSubAreaIdActing").getValue(),
                PersgDest: this.byId("newStatusActing").getValue(),
                PerskDest: this.byId("newJobTitleActing").getValue(),
                HbsDest: this.byId("newHomeBaseActing").getValue(),
                Adjstmn: this.getView().getModel("dropdown").getProperty("/selectedSalaryAdj") || "",
                Zsalary: this.byId("salaryAdjValueActing").getValue(),
                Zdasar1: this.getView().getModel("dropdown").getProperty("/selectedAs") || "",
                Zdasar2: this.byId("basicConActing").getValue(),
                Zassessment: (parseInt(this.getView().getModel("assessmentActing").getProperty("/selectedIndex")) + 1).toString(),
                Zbichecking: Zbichecking, 
                Znotebicheck: this.byId("hasilBiCheckingActing").getValue(),
                Zdisposisi: (parseInt(this.getView().getModel("disposisiActing").getProperty("/selectedIndex")) + 1).toString(), 
                Zsalaryfnl: this.byId("gajiActing").getValue()
            };

            // Show busy dialog
            if (!this._oBusyDialog) {
                this._oBusyDialog = new sap.m.BusyDialog();
            }
            this._oBusyDialog.setTitle("Please wait...");
            this._oBusyDialog.setText("Submitting request...");
            this._oBusyDialog.open();

            // Send request to backend
            let oModel = this.getOwnerComponent().getModel("Acting");
            oModel.create("/RequestSet", oPayload, {
                success: (oData) => {
                    this._oBusyDialog.close();
                    
                    // Show success message
                    sap.m.MessageToast.show("Request submitted successfully.");
                    MessageBox.show("Request has been submitted successfully.", {
                        icon: MessageBox.Icon.SUCCESS,
                        title: "Success"
                    });
                },
                error: (oError) => {
                    this._oBusyDialog.close();
                    
                    // Show error message
                    if (oError) {
                        try {
                            let oErrorMessage = JSON.parse(oError.responseText);
                            MessageBox.error(oErrorMessage.error.message.value);
                        } catch (e) {
                            MessageBox.error("Error submitting request: " + oError.message);
                        }
                    } else {
                        MessageBox.error("Unknown error occurred while submitting request.");
                    }
                },
                urlParameters: {
                    "sap-client": "110"
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
                oRouter.navTo("orgchart", {}, true);
            }
        },

        onSubmit: function () {
            MessageToast.show("Submit button pressed");
        },

        onDisplayDocumentWarning: function () {
            MessageToast.show("Display Document button pressed");
        }
    });
});